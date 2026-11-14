import type { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { verifyCustomerToken } from '../lib/customerAuth.ts';

export const OWNER_EMAIL = 'nigideon36@gmail.com';

export interface AuthRequest extends Request {
  user?: Partial<DecodedIdToken> & { uid: string; authKind?: 'firebase' | 'customer'; phone_number?: string };
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const token = authHeader.split('Bearer ')[1];

  // Check customer mobile session token first
  const customerPayload = verifyCustomerToken(token, 'session');
  if (customerPayload) {
    req.user = {
      uid: customerPayload.sub,
      email: customerPayload.email,
      name: customerPayload.name,
      phone_number: customerPayload.phone,
      authKind: 'customer',
    };
    return next();
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = { ...decodedToken, authKind: 'firebase' };
    next();
  } catch (error) {
    console.error('Error verifying auth token:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

export const optionalAuth = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split('Bearer ')[1];
  const customerPayload = verifyCustomerToken(token, 'session');
  if (customerPayload) {
    req.user = {
      uid: customerPayload.sub,
      email: customerPayload.email,
      name: customerPayload.name,
      phone_number: customerPayload.phone,
      authKind: 'customer',
    };
    return next();
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = { ...decodedToken, authKind: 'firebase' };
  } catch {
    // Non-blocking fallback
  }
  next();
};

export const requireOwner = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Owner sign-in required.' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    const email = decodedToken.email?.toLowerCase();
    if (email !== OWNER_EMAIL || !decodedToken.email_verified) {
      return res.status(403).json({
        error: `Forbidden: Only ${OWNER_EMAIL} has authority to manage website settings, AdSense, or payment gateways.`
      });
    }
    next();
  } catch (error) {
    console.error('Error verifying owner token:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid owner token.' });
  }
};
