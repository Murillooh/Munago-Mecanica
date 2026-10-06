import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

// Classe customizada para erros esperados
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Middleware de erro (deve ser o ÚLTIMO middleware)
export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Logs estruturados
  const errorData = {
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    userId: (req as any).user?.uid || 'anonymous',
    ip: req.ip,
    error: {
      name: err.name,
      message: err.message,
      code: (err as any).code || 'INTERNAL_ERROR',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  };

  if (err instanceof ApiError) {
    // Erros esperados e tratados
    logger.info(errorData, 'ApiError handled');
    
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      ...(process.env.NODE_ENV === 'development' && { details: err.details })
    });
  }

  if ((err as any).code === 'EBADCSRFTOKEN') {
    // CSRF error
    logger.warn(errorData, 'CSRF token invalid');
    return res.status(403).json({
      error: 'CSRF token inválido',
      code: 'CSRF_ERROR'
    });
  }

  if (err instanceof SyntaxError && 'body' in err) {
    // JSON parse error
    logger.warn(errorData, 'Invalid JSON');
    return res.status(400).json({
      error: 'JSON inválido',
      code: 'INVALID_JSON'
    });
  }

  // Erros inesperados
  try {
    logger.error(errorData, 'Unexpected error');
  } catch (logError) {
    console.error('Logging failed:', logError);
    console.error('Original error:', err);
  }

  res.status(500).json({
    error: 'Erro interno do servidor',
    code: 'INTERNAL_ERROR',
    ...(process.env.NODE_ENV === 'development' && { message: String(err.message || err) })
  });
};

// Async wrapper para não precisar try-catch em toda rota
export const asyncHandler = (fn: Function) => (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
