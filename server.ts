import express, { Request, Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { catalogService } from './server/catalogService';
import { HealthResponse } from './src/types';

const PORT = 3000;
const HOST = '0.0.0.0';

async function startServer() {
  const app = express();
  app.use(express.json());

  // Health endpoint
  app.get('/api/health', (req: Request, res: Response) => {
    const healthData: HealthResponse = {
      status: 'ok',
      service: 'Hack-Key Tech Platform Migration Foundation',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      dataSource: catalogService.getDataSourceStatus().isConfigured
        ? 'Google Sheets (Live Connected)'
        : 'Google Sheets (Placeholder Adapter)'
    };
    res.json(healthData);
  });

  // Read-only catalog endpoint
  app.get('/api/catalog', async (req: Request, res: Response) => {
    try {
      const categoryFilter = req.query.category as string | undefined;
      const searchQuery = req.query.q as string | undefined;

      const catalogData = await catalogService.getCatalog(categoryFilter, searchQuery);
      res.json(catalogData);
    } catch (err: any) {
      console.error('[API] Error retrieving catalogue:', err);
      res.status(500).json({
        error: 'Failed to retrieve catalogue from data source',
        message: err.message || 'Internal server error'
      });
    }
  });

  // Vite development middleware or production static asset server
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`[Hack-Key Tech Foundation] Server running at http://${HOST}:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('[Hack-Key Tech Foundation] Fatal server startup error:', err);
  process.exit(1);
});
