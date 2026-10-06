import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import nodemailer from "nodemailer";
import admin from "firebase-admin";
import dotenv from "dotenv";
import fs from "fs";
import { google } from "googleapis";
import cookieParser from "cookie-parser";
import { GoogleGenAI } from "@google/genai";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// Custom modular imports
import logger from "./server/utils/logger.js";
import { errorHandler, asyncHandler, ApiError } from "./server/middleware/errorHandler";
import { 
  emailValidator, 
  passwordValidator, 
  nameValidator, 
  roleValidator, 
  handleValidationErrors 
} from "./server/middleware/validation";

dotenv.config();

// Environment variable validation
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY is required'),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional(),
  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().optional(),
  EMAIL_USER: z.string().email().optional(),
  EMAIL_PASS: z.string().optional(),
  APP_URL: z.string().url().default('http://localhost:3000'),
  JWT_SECRET: z.string().default('loc-estoque-default-secret-change-me'),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
});

const envResult = envSchema.safeParse(process.env);
if (!envResult.success) {
  logger.error(envResult.error.format(), "Environment variable validation failed");
  process.exit(1);
}
const env = envResult.data;

const firebaseConfig = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  const PORT = env.PORT;

  // CORS Configuration
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    env.APP_URL
  ].filter(Boolean) as string[];

  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.some(o => origin.startsWith(o))) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Google-Tokens']
  }));

  // Rate Limiting
  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    message: { error: 'Muitas requisições, tente novamente mais tarde' },
    standardHeaders: true,
    legacyHeaders: false
  });

  const geminiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30, // Increased for better interactivity
    message: { error: 'Limite de requisições ao Gemini excedido. Tente novamente em 1 minuto.' },
    standardHeaders: true,
    legacyHeaders: false
  });

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: 'Muitas tentativas de login. Tente novamente em 15 minutos.' },
    skipSuccessfulRequests: true
  });

  app.use("/api", globalLimiter);
  app.use(express.json());
  app.use(cookieParser());

  // Google OAuth Client
  const GOOGLE_CLIENT_ID = env.GOOGLE_CLIENT_ID;
  const GOOGLE_CLIENT_SECRET = env.GOOGLE_CLIENT_SECRET;
  
  // Normalize APP_URL
  let APP_URL = env.APP_URL;
  if (APP_URL.endsWith('/')) {
    APP_URL = APP_URL.slice(0, -1);
  }
  
  const GOOGLE_REDIRECT_URI = env.GOOGLE_REDIRECT_URI || `${APP_URL}/auth/google/callback`;

  logger.info({
    appUrl: APP_URL,
    redirectUri: GOOGLE_REDIRECT_URI,
    hasClientId: !!GOOGLE_CLIENT_ID
  }, 'Initializing Google OAuth');

  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );

  // Initialize Firebase Admin
  if (admin.apps.length === 0) {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      try {
        const serviceAccount = JSON.parse(
          process.env.FIREBASE_SERVICE_ACCOUNT_JSON.startsWith("{")
            ? process.env.FIREBASE_SERVICE_ACCOUNT_JSON
            : Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_JSON, "base64").toString()
        );
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
        console.log("Firebase Admin initialized with service account.");
      } catch (error) {
        console.error("Error initializing Firebase Admin with service account:", error);
        try {
          admin.initializeApp();
          console.log("Firebase Admin initialized with default credentials (fallback).");
        } catch (fallbackError) {
          console.error("Error initializing Firebase Admin with default credentials (fallback):", fallbackError);
        }
      }
    } else {
      try {
        admin.initializeApp();
        console.log("Firebase Admin initialized with default credentials.");
      } catch (error) {
        console.warn("FIREBASE_SERVICE_ACCOUNT_JSON not found and default credentials failed. User creation will likely fail.", error);
      }
    }
  }

  // API Routes
  app.post("/api/users/create", 
    emailValidator,
    nameValidator,
    roleValidator,
    handleValidationErrors,
    asyncHandler(async (req: any, res: any) => {
      const { email, name, role, permissions } = req.body;

      logger.info({ email, role }, 'Creating new user with secure password flow');
      
      // 1. Generate secure temporary password
      const tempPassword = crypto.randomBytes(12).toString('hex');

      // 2. Create user in Firebase Auth
      const userRecord = await admin.auth().createUser({
        email,
        password: tempPassword,
        displayName: name,
      });

      // 3. Create JWT for setup
      const resetToken = jwt.sign(
        {
          uid: userRecord.uid,
          email: email,
          type: 'initial_password_setup',
          iat: Math.floor(Date.now() / 1000)
        },
        env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      const tokenHash = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');

      // 4. Create user document in Firestore
      const db = admin.firestore(firebaseConfig.firestoreDatabaseId);
      const emailId = email.toLowerCase().trim();
      
      await db.collection("users").doc(userRecord.uid).set({
        email: emailId,
        name,
        role: role === 'user' ? 'viewer' : role,
        ...(permissions && { permissions }),
        uid: userRecord.uid,
        status: 'pending',
        passwordResetToken: tokenHash,
        passwordResetExpires: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 24 * 60 * 60 * 1000)),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 5. Send Welcome Email with link
      if (env.EMAIL_USER && env.EMAIL_PASS) {
        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: env.EMAIL_USER,
            pass: env.EMAIL_PASS,
          },
        });

        const resetLink = `${env.APP_URL}/auth/set-password?token=${encodeURIComponent(resetToken)}`;

        const mailOptions = {
          from: `"Munago Estoque" <${env.EMAIL_USER}>`,
          to: email,
          subject: "Bem-vindo ao Munago Estoque - Configure sua Senha",
          html: `
            <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; margin: auto;">
              <h2 style="color: #2563eb;">Bem-vindo ao Munago Estoque, ${name}!</h2>
              <p>Sua conta de acesso foi criada com sucesso pelo administrador.</p>
              <div style="background: #fdf2f2; border-left: 4px solid #ef4444; padding: 15px; border-radius: 4px; margin: 20px 0;">
                <p><strong>Usuário (Email):</strong> ${email}</p>
                <p>Para sua segurança, você deve configurar sua senha pessoal clicando no botão abaixo:</p>
              </div>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetLink}" style="background-color: #2563eb; color: white; padding: 12px 25px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">CONFIGURAR MINHA SENHA</a>
              </div>
              <p style="font-size: 0.9em; color: #666;">Este link é válido por 24 horas. Se não funcionar, copie este link no navegador:</p>
              <p style="font-size: 0.8em; word-break: break-all; color: #999;">${resetLink}</p>
              <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
              <p style="font-size: 0.8em; color: #999;">Equipe de Gestão Munago Estoque.</p>
            </div>
          `,
        };

        await transporter.sendMail(mailOptions);
        logger.info({ email }, 'Setup link sent to user');
      }

      res.status(201).json({ 
        uid: userRecord.uid,
        message: 'Usuário criado. Link de configuração enviado por e-mail.'
      });
    })
  );

  app.post("/api/auth/set-password", asyncHandler(async (req: any, res: any) => {
    const { token, newPassword } = req.body;

    if (!token || !newPassword || newPassword.length < 8) {
      throw new ApiError(400, 'INVALID_INPUT', 'Dados inválidos para alteração de senha.');
    }

    // 1. Verify JWT
    const decoded = jwt.verify(token, env.JWT_SECRET) as any;
    if (decoded.type !== 'initial_password_setup') {
      throw new ApiError(400, 'INVALID_TOKEN_TYPE', 'Tipo de token inválido.');
    }

    // 2. Hash and check in Firestore
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const db = admin.firestore(firebaseConfig.firestoreDatabaseId);
    const userSnapshot = await db.collection("users").where('uid', '==', decoded.uid).get();

    if (userSnapshot.empty) {
      throw new ApiError(404, 'USER_NOT_FOUND', 'Usuário não encontrado.');
    }

    const userDoc = userSnapshot.docs[0];
    const userData = userDoc.data();

    if (!userData.passwordResetToken || userData.passwordResetToken !== tokenHash) {
      throw new ApiError(401, 'LINK_EXPIRED_OR_USED', 'O link expirou ou já foi utilizado.');
    }

    // 3. Update Firebase Auth
    await admin.auth().updateUser(decoded.uid, {
      password: newPassword
    });

    // 4. Update Firestore and Approve
    await userDoc.ref.update({
      passwordResetToken: admin.firestore.FieldValue.delete(),
      passwordResetExpires: admin.firestore.FieldValue.delete(),
      status: 'approved'
    });

    logger.info({ uid: decoded.uid }, 'Password set successfully via secure link');
    res.json({ success: true, message: 'Senha configurada com sucesso!' });
  }));

  // Google Auth Routes
  app.get("/api/auth/google/config", (req, res) => {
    res.json({ 
      redirectUri: GOOGLE_REDIRECT_URI,
      hasClientId: !!GOOGLE_CLIENT_ID,
      hasClientSecret: !!GOOGLE_CLIENT_SECRET
    });
  });

  // Gemini API Routes
  app.post("/api/gemini/generate", geminiLimiter, async (req, res, next) => {
    const { model, contents, config, systemInstruction } = req.body;
    try {
      const response = await ai.models.generateContent({
        model: model || "gemini-flash-latest",
        contents,
        config: {
          ...config,
          systemInstruction
        }
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

  app.post("/api/gemini/chat-stream", geminiLimiter, async (req, res, next) => {
    const { model, contents, config, systemInstruction } = req.body;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const timeout = setTimeout(() => {
      res.write(`data: ${JSON.stringify({ error: "Interrupção por timeout (30s)" })}\n\n`);
      res.end();
    }, 30000);

    try {
      const stream = await ai.models.generateContentStream({
        model: model || "gemini-flash-latest",
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
      let errorMessage = error.message;
      if (isQuotaError) errorMessage = "Limite de cota atingido. Tente novamente mais tarde.";
      
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);
        res.end();
      }
    } finally {
      clearTimeout(timeout);
    }
  });

  app.post("/api/gemini/generate-image", async (req, res) => {
    const { model, prompt, config } = req.body;
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY not configured" });
    }
    try {
      const response = await ai.models.generateContent({
        model: model || "gemini-2.5-flash-image",
        contents: [{ text: prompt }],
        config: config || {
          imageConfig: { aspectRatio: "1:1", imageSize: "1K" }
        }
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
      console.error("Gemini image error:", error);
      const isQuotaError = error.message?.includes("429") || error.message?.includes("RESOURCE_EXHAUSTED");
      const isKeyError = error.message?.includes("403") || error.message?.includes("400") || error.message?.includes("API_KEY_INVALID") || error.message?.includes("PERMISSION_DENIED");
      
      let message = error.message;
      if (isQuotaError) message = "Limite de cota atingido para geração de imagens.";
      if (isKeyError) message = "Chave de API sem permissão para geração de imagens.";

      res.status(500).json({ error: message });
    }
  });

  app.get("/api/auth/google/check", (req, res) => {
    const tokensCookie = req.cookies.google_tokens;
    res.json({ authenticated: !!tokensCookie });
  });

  app.get("/api/auth/google/url", (req, res) => {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return res.status(500).json({ 
        error: "Configuração incompleta: GOOGLE_CLIENT_ID ou GOOGLE_CLIENT_SECRET não foram encontrados nas variáveis de ambiente (Secrets)." 
      });
    }

    const scopes = [
      "https://www.googleapis.com/auth/spreadsheets.readonly",
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/userinfo.email",
    ];

    const state = (req.query.nonce as string) || "";

    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: scopes,
      prompt: "consent",
      state: state,
      redirect_uri: GOOGLE_REDIRECT_URI,
    });

    res.json({ url });
  });

  app.get("/auth/google/callback", async (req, res, next) => {
    const { code, state } = req.query;

    if (!code) {
      return res.status(400).send("No code provided");
    }

    try {
      logger.info('Exchanging code for tokens...');
      const { tokens } = await oauth2Client.getToken(code as string);
      
      // Secondary cookie storage
      res.cookie("google_tokens", JSON.stringify(tokens), {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });

      const nonce = (state as string) || crypto.createHash('sha256').update(Math.random().toString()).digest('hex');
      const tokensJson = JSON.stringify(tokens);
      const escapedJson = JSON.stringify(tokensJson); // Double escaped for script injection safety

      res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <title>Autenticação Munago Estoque</title>
          </head>
          <body>
            <p style="font-family: sans-serif; text-align: center; margin-top: 50px;">Autenticação bem-sucedida! Fechando janela...</p>
            <script>
              try {
                if (!window.opener) {
                  window.location.href = '/';
                }

                const tokensJson = JSON.parse(${escapedJson});
                const tokens = JSON.parse(tokensJson);

                window.opener.postMessage({ 
                  type: 'OAUTH_AUTH_SUCCESS', 
                  provider: 'google',
                  tokens: tokens,
                  nonce: '${nonce}',
                  timestamp: Date.now()
                }, env.FRONTEND_URL || window.location.origin);
                
                setTimeout(() => window.close(), 1000);
              } catch(e) {
                console.error('Auth error:', e);
                if (window.opener) {
                  window.opener.postMessage({ 
                    type: 'OAUTH_AUTH_FAILED', 
                    error: 'Falha no processamento de segurança'
                  }, window.location.origin);
                }
                setTimeout(() => window.close(), 2000);
              }
            </script>
          </body>
        </html>
      `);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/sheets/data", async (req, res) => {
    const spreadsheetId = req.query.spreadsheetId as string;
    const range = (req.query.range as string) || "A1:Z100";
    
    // Try to get tokens from header first, then cookie
    let tokensCookie = req.headers['x-google-tokens'] as string || req.cookies.google_tokens;

    if (!spreadsheetId) {
      return res.status(400).json({ error: "Spreadsheet ID is required" });
    }

    if (!tokensCookie) {
      return res.status(401).json({ error: "Not authenticated with Google. Please connect your account." });
    }

    try {
      const tokens = JSON.parse(tokensCookie);
      
      // Create a fresh client for this request to avoid state pollution
      const requestAuth = new google.auth.OAuth2(
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET,
        GOOGLE_REDIRECT_URI
      );
      requestAuth.setCredentials(tokens);

      const sheets = google.sheets({ version: "v4", auth: requestAuth });
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
      });

      res.json({ values: response.data.values });
    } catch (error: any) {
      console.error("Error fetching sheet data:", error);
      
      if (error.message.includes('invalid_grant') || error.message.includes('invalid_token')) {
        return res.status(401).json({ error: "Sessão expirada ou inválida. Por favor, conecte-se novamente." });
      }
      
      res.status(500).json({ error: `Erro na API do Google: ${error.message}` });
    }
  });

  app.get("/api/download-project", async (req, res) => {
    const { exec } = await import("child_process");
    const { promisify } = await import("util");
    const execPromise = promisify(exec);

    try {
      const zipPath = path.join(process.cwd(), "project-export.zip");
      
      // List of files and folders to include in the zip
      // This is safer than excluding, as it avoids errors when excluded folders don't exist
      const itemsToInclude = [
        "src",
        "package.json",
        "package-lock.json",
        "server.ts",
        "tsconfig.json",
        "vite.config.ts",
        "index.html",
        "metadata.json",
        "firestore.rules",
        "firebase-blueprint.json",
        "firebase-applet-config.json",
        ".env.example",
        ".gitignore"
      ].join(" ");

      console.log("Creating project zip with items:", itemsToInclude);
      
      // Use npx bestzip to create the zip file
      await execPromise(`npx -y bestzip project-export.zip ${itemsToInclude}`);
      
      if (!fs.existsSync(zipPath)) {
        throw new Error("Zip file was not created successfully.");
      }

      res.download(zipPath, "projeto-loc-estoque.zip", (err) => {
        if (err) {
          console.error("Error sending file:", err);
        }
        // Clean up after sending
        fs.unlink(zipPath, (unlinkErr) => {
          if (unlinkErr) console.error("Error deleting temp zip:", unlinkErr);
        });
      });
    } catch (error: any) {
      console.error("Error creating project zip:", error);
      res.status(500).json({ 
        error: "Erro ao gerar o arquivo ZIP do projeto.",
        details: error.message 
      });
    }
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
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Global Error Handler
  app.use(errorHandler);

  app.listen(PORT, "0.0.0.0", () => {
    logger.info(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
