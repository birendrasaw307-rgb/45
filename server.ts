import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import axios from 'axios';
import multer from 'multer';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  const s3Client = new S3Client({
    region: 'ap-south-1', // Supabase will ignore region but client requires it
    endpoint: process.env.SUPABASE_S3_ENDPOINT || 'https://lpvmyttlmvfhshqaojgt.supabase.co/storage/v1/s3',
    credentials: {
      accessKeyId: process.env.SUPABASE_S3_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.SUPABASE_S3_SECRET_ACCESS_KEY || '',
    },
    forcePathStyle: true, // required for Supabase S3
  });

  const upload = multer({ storage: multer.memoryStorage() });

  app.post('/api/upload', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const fileExt = req.file.originalname.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
      const bucketName = 'Photo';

      await s3Client.send(new PutObjectCommand({
        Bucket: bucketName,
        Key: fileName,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      }));

      // Supabase public URL format
      const supabaseUrl = process.env.SUPABASE_URL || 'https://lpvmyttlmvfhshqaojgt.supabase.co';
      const publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucketName}/${fileName}`;
      res.json({ url: publicUrl });
    } catch (err: any) {
      console.error('Upload Error:', err);
      res.status(500).json({ error: 'Failed to upload image' });
    }
  });

  app.get('/api/config', (req, res) => {
    res.json({ env: process.env.CASHFREE_ENV || 'SANDBOX' });
  });

  app.post('/api/create-order', async (req, res) => {
    try {
      const { amount, customerId, customerEmail, customerPhone, returnUrl } = req.body;
      const CF_APP_ID = process.env.CASHFREE_APP_ID;
      const CF_SECRET = process.env.CASHFREE_SECRET_KEY;
      const CF_ENV = process.env.CASHFREE_ENV || 'SANDBOX';
      const CF_BASE_URL = CF_ENV === 'PRODUCTION' 
        ? 'https://api.cashfree.com/pg' 
        : 'https://sandbox.cashfree.com/pg';

      if (!CF_APP_ID || !CF_SECRET) {
        return res.status(500).json({ error: 'Cashfree credentials not configured' });
      }

      const orderId = `order_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      // Always fall back to HTTPS if 'host' is present, else standard
      const host = req.get('host');
      const protocol = host?.includes('localhost') ? 'http' : 'https';

      const payload = {
        order_id: orderId,
        order_amount: amount,
        order_currency: 'INR',
        customer_details: {
          customer_id: customerId || 'guest',
          customer_email: customerEmail || 'test@example.com',
          customer_phone: customerPhone || '9999999999'
        },
        order_meta: {
          return_url: returnUrl || `${protocol}://${host}/?order_id={order_id}`
        }
      };

      const cfRes = await axios.post(`${CF_BASE_URL}/orders`, payload, {
        headers: {
          'x-client-id': CF_APP_ID,
          'x-client-secret': CF_SECRET,
          'x-api-version': '2023-08-01',
          'Content-Type': 'application/json'
        }
      });

      res.json(cfRes.data);
    } catch (err: any) {
      console.error('Create Order Error:', err.response?.data || err.message);
      const isAuthError = err.response?.data?.type === 'authentication_error';
      res.status(isAuthError ? 401 : 500).json({ 
        error: isAuthError ? 'Cashfree Authentication Failed' : (err.response?.data?.message || 'Failed to create order.'),
        details: isAuthError ? 'Please ensure your Cashfree App ID and Secret Key in environment variables are correct for the selected environment (Sandbox/Production).' : undefined
      });
    }
  });

  app.get('/api/check-order/:orderId', async (req, res) => {
    try {
      const { orderId } = req.params;
      const CF_APP_ID = process.env.CASHFREE_APP_ID;
      const CF_SECRET = process.env.CASHFREE_SECRET_KEY;
      const CF_ENV = process.env.CASHFREE_ENV || 'SANDBOX';
      const CF_BASE_URL = CF_ENV === 'PRODUCTION' 
        ? 'https://api.cashfree.com/pg' 
        : 'https://sandbox.cashfree.com/pg';
        
      if (!CF_APP_ID || !CF_SECRET) {
        return res.status(500).json({ error: 'Cashfree credentials not configured' });
      }

      const orderRes = await axios.get(`${CF_BASE_URL}/orders/${orderId}`, {
        headers: {
          'x-client-id': CF_APP_ID,
          'x-client-secret': CF_SECRET,
          'x-api-version': '2023-08-01',
        }
      });
      
      let paymentRes;
      try {
        paymentRes = await axios.get(`${CF_BASE_URL}/orders/${orderId}/payments`, {
             headers: {
              'x-client-id': CF_APP_ID,
              'x-client-secret': CF_SECRET,
              'x-api-version': '2023-08-01',
            }
        });
      } catch (e) {
        console.warn('Failed to fetch payments:', e);
      }

      res.json({
        order: orderRes.data,
        payments: paymentRes?.data || []
      });
    } catch (error: any) {
      console.error('Check Order Error:', error.response?.data || error.message);
      const isAuthError = error.response?.data?.type === 'authentication_error';
      res.status(isAuthError ? 401 : 500).json({ 
        error: isAuthError ? 'Cashfree Authentication Failed' : (error.response?.data?.message || 'Failed to fetch order details. Please check the ID.'),
        details: isAuthError ? 'Please ensure your Cashfree App ID and Secret Key in environment variables are correct.' : undefined
      });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
