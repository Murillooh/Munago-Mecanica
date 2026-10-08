import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import crypto from 'crypto';

// Custom modular imports
import logger from "./server/utils/logger.js";
import { errorHandler } from "./server/middleware/errorHandler";
import { createDb } from "./server/db/client";
import { ChangeBus } from "./server/realtime/events";
import { startPgChangeListener } from "./server/realtime/pgListener";
import { createApiRouter } from "./server/api";
import { authMiddleware, requireAdmin, requirePermission } from "./server/auth/middleware";
import { createCognitoAdmin, createCognitoVerifier } from "./server/auth/cognito";
import { runAutoBackupIfDue } from "./server/services/backup";
import { createGoogleOAuth } from "./server/google/oauth";
import { createGoogleRouter } from "./server/routes/google";
import { SUPPORT_MODELS, buildSupportPrompt, isTransientAiError, supportChatInput, toGeminiContents } from "./server/support/supportChat";

dotenv.config();

// Environment variable validation
const envSchema = z.object({
  // O bundle de produção (dist/server.cjs) já define 'production' se faltar (banner no build).
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  // Proxies na frente do Express (produção: Vercel → CloudFront → nginx = 3), para req.ip ser o do cliente.
  TRUST_PROXY: z.coerce.number().int().min(0).default(1),
  // Opcional: sem a chave o servidor sobe e as rotas de IA respondem 500.
  GEMINI_API_KEY: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional(),
  APP_URL: z.string().url().default('http://localhost:3000'),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  AWS_REGION: z.string().default('sa-east-1'),
  COGNITO_USER_POOL_ID: z.string().min(1, 'COGNITO_USER_POOL_ID is required'),
  COGNITO_CLIENT_ID: z.string().min(1, 'COGNITO_CLIENT_ID is required'),
  BOOTSTRAP_ADMIN_EMAILS: z.string().default(''),
});

const envResult = envSchema.safeParse(process.env);
if (!envResult.success) {
  logger.error(envResult.error.format(), "Environment variable validation failed");
  process.exit(1);
}
const env = envResult.data;

const cognitoConfig = { region: env.AWS_REGION, userPoolId: env.COGNITO_USER_POOL_ID, clientId: env.COGNITO_CLIENT_ID };
const db = createDb(env.DATABASE_URL);
const bus = new ChangeBus();
startPgChangeListener(env.DATABASE_URL, bus, logger);
const verifier = createCognitoVerifier(cognitoConfig);
const bootstrapAdmins = env.BOOTSTRAP_ADMIN_EMAILS.split(',');
// Rotas legadas fora do /api/v1 (Gemini) também exigem login.
const requireLogin = [authMiddleware({ db, verifier, bootstrapAdmins }), requirePermission()];

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Modelos e parâmetros fixos no servidor: o cliente não escolhe modelo caro nem ferramentas.
const GEMINI_TEXT_MODELS = ['gemini-flash-latest', 'gemini-3.5-flash'] as const;
const geminiTextInput = z.object({
  model: z.enum(GEMINI_TEXT_MODELS).default('gemini-flash-latest'),
  contents: z.union([
    z.string().min(1).max(500_000), // resumo do estoque manda todos os produtos
    z.array(z.object({
      role: z.enum(['user', 'model']).optional(),
      parts: z.array(z.object({ text: z.string().max(500_000) })).min(1).max(20),
    })).min(1).max(50),
  ]),
  systemInstruction: z.string().max(20_000).optional(),
  // Só estes campos passam; o resto (tools, safetySettings...) é descartado.
  config: z.object({
    temperature: z.number().min(0).max(2).optional(),
    maxOutputTokens: z.number().int().min(1).max(4096).optional(),
  }).default({}),
});
const geminiImageInput = z.object({
  prompt: z.string().min(1).max(2000),
  config: z.object({
    imageConfig: z.object({ aspectRatio: z.enum(['1:1', '4:3', '3:4', '16:9', '9:16']).default('1:1') }).default({ aspectRatio: '1:1' }),
  }).optional(),
}).transform(({ prompt, config }) => ({ prompt, aspectRatio: config?.imageConfig.aspectRatio ?? '1:1' }));

async function startServer() {
  const app = express();
  app.set('trust proxy', env.TRUST_PROXY);
  const PORT = env.PORT;

  // CORS: comparação exata de origem (startsWith aceitaria "https://app.com.evil.com").
  const allowedOrigins = new Set([
    ...(env.NODE_ENV === 'production' ? [] : ['http://localhost:3000', 'http://localhost:5173']),
    new URL(env.APP_URL).origin,
    new URL(env.FRONTEND_URL).origin,
  ]);

  // CSP completa fica de fora: o SPA (Vite/Vercel) tem script inline de tema. Aqui só o que não quebra nada.
  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        // Sem useDefaults o helmet exige default-src; aqui ela fica desligada de propósito (ver comentário acima).
        "default-src": helmet.contentSecurityPolicy.dangerouslyDisableDefaultSrc,
        "frame-ancestors": ["'none'"],
        "object-src": ["'none'"],
        "base-uri": ["'self'"],
      },
    },
    // O popup do Google precisa de window.opener para avisar o app.
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  }));

  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));

  // Rate Limiting
  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    message: { error: 'Muitas requisições, tente novamente mais tarde' },
    standardHeaders: true,
    legacyHeaders: false
  });

  // Por usuário (roda depois do login): vários usuários atrás do mesmo IP da oficina não se bloqueiam.
  const geminiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    keyGenerator: (req) => req.user!.id,
    message: { error: 'Limite de requisições ao Gemini excedido. Tente novamente em 1 minuto.' },
    standardHeaders: true,
    legacyHeaders: false
  });

  // Formulário público "solicitar acesso"
  const accessRequestLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: { error: 'Muitas solicitações. Tente novamente mais tarde.', code: 'RATE_LIMITED' },
    standardHeaders: true,
    legacyHeaders: false
  });

  app.use("/api", globalLimiter);
  // Imagens em data URL (produtos, categorias, logo) passam do limite padrão de 100kb.
  app.use(express.json({ limit: '2mb' }));

  const APP_URL = env.APP_URL.replace(/\/$/, '');
  const GOOGLE_REDIRECT_URI = env.GOOGLE_REDIRECT_URI || `${APP_URL}/auth/google/callback`;
  logger.info({ appUrl: APP_URL, redirectUri: GOOGLE_REDIRECT_URI, hasClientId: !!env.GOOGLE_CLIENT_ID }, 'Initializing Google OAuth');

  const googleOAuth = createGoogleOAuth({
    db,
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    redirectUri: GOOGLE_REDIRECT_URI,
  });

  // API v1: Postgres (RDS) + Cognito. Substitui Firestore, firestore.rules e Firebase Auth.
  app.use("/api/v1", createApiRouter({
    db, bus, verifier, bootstrapAdmins,
    cognito: createCognitoAdmin(cognitoConfig),
    publicLimiter: accessRequestLimiter,
    extra: (r) => r.use(createGoogleRouter(googleOAuth)),
  }));

  // Gemini API Routes
  app.post("/api/gemini/generate", ...requireLogin, geminiLimiter, async (req, res, next) => {
    const parsed = geminiTextInput.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Requisição de IA inválida.', code: 'VALIDATION' });
    const { model, contents, config, systemInstruction } = parsed.data;
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: { ...config, systemInstruction }
      });
      res.json({ text: response.text });
    } catch (error: any) {
      const isQuotaError = error.message?.includes("429") || error.message?.includes("RESOURCE_EXHAUSTED");
      if (isQuotaError) {
        return res.status(429).json({ 
          error: "Limite de cota do Gemini excedido. Por favor, tente novamente em alguns instantes.",
          code: "RESOURCE_EXHAUSTED"
        });
      }
      next(error);
    }
  });

  app.post("/api/gemini/chat-stream", ...requireLogin, geminiLimiter, async (req, res) => {
    const parsed = geminiTextInput.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Requisição de IA inválida.', code: 'VALIDATION' });
    const { model, contents, config, systemInstruction } = parsed.data;

    // Sem chave a chamada falharia no meio do stream; responde antes com erro claro.
    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({ error: "GEMINI_API_KEY não configurada no servidor." });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const timeout = setTimeout(() => {
      res.write(`data: ${JSON.stringify({ error: "Interrupção por timeout (30s)" })}\n\n`);
      res.end();
    }, 30000);

    try {
      const stream = await ai.models.generateContentStream({
        model,
        contents: typeof contents === 'string' ? [{ role: 'user', parts: [{ text: contents }] }] : contents,
        config: {
          ...config,
          systemInstruction,
          tools: [{ googleSearch: {} }],
        }
      });

      for await (const chunk of stream) {
        if (res.writableEnded) break;
        res.write(`data: ${JSON.stringify({
          text: chunk.text,
          groundingMetadata: chunk.candidates?.[0]?.groundingMetadata
        })}\n\n`);
      }
      if (!res.writableEnded) {
        res.write('data: [DONE]\n\n');
        res.end();
      }
    } catch (error: any) {
      logger.error(error, "Gemini stream error");
      const isQuotaError = error.message?.includes("429") || error.message?.includes("RESOURCE_EXHAUSTED");
      const errorMessage = isQuotaError
        ? "Limite de cota atingido. Tente novamente mais tarde."
        : "Erro ao consultar a IA. Tente novamente.";
      
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);
        res.end();
      }
    } finally {
      clearTimeout(timeout);
    }
  });

  // Chat de suporte (Ana): roteiro e base de conhecimento ficam aqui, não vêm do navegador. Sem busca na web.
  app.post("/api/support/chat", ...requireLogin, geminiLimiter, async (req, res) => {
    const parsed = supportChatInput.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Mensagem inválida.', code: 'VALIDATION' });
    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({ error: "A assistente está indisponível no momento (IA não configurada)." });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    const timeout = setTimeout(() => {
      res.write(`data: ${JSON.stringify({ error: "A resposta demorou demais. Tente de novo." })}\n\n`);
      res.end();
    }, 30000);

    const request = {
      contents: toGeminiContents(parsed.data.messages),
      config: {
        systemInstruction: buildSupportPrompt({ userName: req.user!.name, role: req.user!.role, screen: parsed.data.screen }),
        temperature: 0.7,
        maxOutputTokens: 900,
      },
    };
    let wroteText = false;
    try {
      for (const [i, model] of SUPPORT_MODELS.entries()) {
        try {
          const stream = await ai.models.generateContentStream({ model, ...request });
          for await (const chunk of stream) {
            if (res.writableEnded) break;
            if (chunk.text) { wroteText = true; res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`); }
          }
          break;
        } catch (error) {
          // Só troca de modelo se nada foi enviado ainda; senão a resposta sairia duplicada.
          const canFallback = !wroteText && i < SUPPORT_MODELS.length - 1 && isTransientAiError(error);
          if (!canFallback) throw error;
          logger.warn({ model, err: (error as Error).message?.slice(0, 200) }, "Support chat: modelo sobrecarregado, usando reserva");
        }
      }
      if (!res.writableEnded) {
        res.write('data: [DONE]\n\n');
        res.end();
      }
    } catch (error: any) {
      logger.error(error, "Support chat error");
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ error: isTransientAiError(error) ? "Estou recebendo muitas perguntas agora. Tenta de novo em um minutinho?" : "Não consegui responder agora. Tente de novo em instantes." })}\n\n`);
        res.end();
      }
    } finally {
      clearTimeout(timeout);
    }
  });

  app.post("/api/gemini/generate-image", ...requireLogin, geminiLimiter, async (req, res) => {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY not configured" });
    }
    const parsed = geminiImageInput.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Requisição de IA inválida.', code: 'VALIDATION' });
    const { prompt, aspectRatio } = parsed.data;
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: [{ text: prompt }],
        config: { imageConfig: { aspectRatio, imageSize: "1K" } }
      });
      
      let imagePart = null;
      let textPart = "";
      
      if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            imagePart = part.inlineData;
            break;
          }
          if (part.text) {
            textPart += part.text;
          }
        }
      }
      
      res.json({ image: imagePart, text: textPart });
    } catch (error: any) {
      logger.error(error, "Gemini image error");
      const isQuotaError = error.message?.includes("429") || error.message?.includes("RESOURCE_EXHAUSTED");
      const isKeyError = error.message?.includes("403") || error.message?.includes("400") || error.message?.includes("API_KEY_INVALID") || error.message?.includes("PERMISSION_DENIED");
      
      let message = "Erro ao gerar a imagem. Tente novamente.";
      if (isQuotaError) message = "Limite de cota atingido para geração de imagens.";
      if (isKeyError) message = "Chave de API sem permissão para geração de imagens.";

      res.status(500).json({ error: message });
    }
  });

  // Callback do Google (popup). O state assinado diz de qual usuário são os tokens;
  // eles ficam no banco e a página só avisa a janela do app que a conexão terminou.
  app.get("/auth/google/callback", async (req, res) => {
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    let ok = false;
    if (code && state) {
      try {
        await googleOAuth.handleCallback(code, state);
        ok = true;
      } catch (error) {
        logger.warn({ err: error instanceof Error ? error.message : error }, 'Google OAuth callback failed');
      }
    }
    // Cookie da versão antiga (tokens no navegador).
    res.clearCookie("google_tokens", { httpOnly: true, secure: true, sameSite: "none" });

    const nonce = crypto.randomBytes(16).toString('base64');
    // Serializa para dentro de <script> sem permitir fechar a tag (XSS).
    const inlineJson = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c');
    const message = ok
      ? { type: 'OAUTH_AUTH_SUCCESS', provider: 'google' }
      : { type: 'OAUTH_AUTH_FAILED', error: 'Não foi possível conectar a conta Google.' };

    res.set({
      'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'`,
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
    });
    res.status(ok ? 200 : 400).send(`<!DOCTYPE html>
<html lang="pt-BR">
  <head><meta charset="UTF-8"><title>Autenticação Munago Estoque</title></head>
  <body>
    <p style="font-family: sans-serif; text-align: center; margin-top: 50px;">${ok ? 'Conta Google conectada! Fechando janela...' : 'Não foi possível conectar a conta Google. Feche esta janela e tente novamente.'}</p>
    <script nonce="${nonce}">
      if (window.opener) window.opener.postMessage(${inlineJson(message)}, ${inlineJson(new URL(env.FRONTEND_URL).origin)});
      setTimeout(function () { window.opener ? window.close() : (window.location.href = '/'); }, ${ok ? 1000 : 4000});
    </script>
  </body>
</html>`);
  });

  // Rota de API inexistente: 404 em JSON, não o index.html do SPA.
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: 'Rota não encontrada.', code: 'NOT_FOUND' });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    // extensions: /privacidade e /termos servem os .html públicos (link exigido pelo Google OAuth).
    // Arquivos em /assets têm hash no nome: cache de 1 ano é seguro. HTML sempre revalida
    // para que um deploy novo apareça na hora.
    app.use('/assets', express.static(path.join(distPath, 'assets'), { immutable: true, maxAge: '1y', fallthrough: false }));
    app.use(express.static(distPath, {
      extensions: ['html'],
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
      },
    }));
    app.get("*", (req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Global Error Handler
  app.use(errorHandler);

  app.listen(PORT, "0.0.0.0", () => {
    logger.info(`Server running on http://localhost:${PORT}`);
  });

  // Backup automático diário (quando ligado em Configurações). Verifica de hora em hora.
  const backupTick = () => runAutoBackupIfDue(db)
    .then((done) => done && logger.info('Automatic backup created'))
    .catch((err) => logger.error(err, 'Automatic backup failed'));
  backupTick();
  setInterval(backupTick, 60 * 60 * 1000).unref();
}

startServer();
