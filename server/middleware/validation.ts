import { body, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';

// Validadores reutilizáveis
export const emailValidator = body('email')
  .trim()
  .isEmail()
  .normalizeEmail()
  .withMessage('Email deve ser válido');

export const passwordValidator = body('password')
  .isLength({ min: 8 })
  .withMessage('Senha deve ter no mínimo 8 caracteres')
  .matches(/^(?=.*[A-Z])/, 'Deve conter letra maiúscula')
  .matches(/^(?=.*[a-z])/, 'Deve conter letra minúscula')
  .matches(/^(?=.*\d)/, 'Deve conter número')
  .matches(/^(?=.*[@$!%*#?&])/, 'Deve conter caractere especial (@$!%*#?&)');

export const nameValidator = body('name')
  .trim()
  .isLength({ min: 3, max: 100 })
  .withMessage('Nome deve ter 3-100 caracteres')
  .matches(/^[a-zA-ZÀ-ú\s'-]+$/)
  .withMessage('Nome contém caracteres inválidos');

export const roleValidator = body('role')
  .isIn(['admin', 'editor', 'viewer'])
  .withMessage('Role deve ser admin, editor ou viewer');

// Para produtos
export const productNameValidator = body('name')
  .trim()
  .isLength({ min: 1, max: 200 })
  .withMessage('Nome do produto deve ter 1-200 caracteres');

export const quantityValidator = body('quantity')
  .isInt({ min: 0 })
  .withMessage('Quantidade deve ser um número não-negativo');

export const priceValidator = body('price')
  .optional()
  .isFloat({ min: 0 })
  .withMessage('Preço deve ser um número positivo');

// Middleware para lidar com erros de validação
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validação falhou',
      code: 'VALIDATION_ERROR',
      details: errors.array().map((e: any) => ({
        field: e.path,
        message: e.msg,
        value: e.value
      }))
    });
  }
  
  next();
};
