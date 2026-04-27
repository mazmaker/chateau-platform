import express from 'express';
import { createClient } from 'redis';
import cors from 'cors';

const app = express();
const port = 7373;

// Enable CORS for all routes
app.use(cors());
app.use(express.json());

// Create Redis client
const client = createClient({
  url: 'redis://localhost:6379'
});

client.on('error', (err) => {
  console.error('Redis Client Error', err);
});

client.connect().then(() => {
  console.log('Connected to Redis successfully');
}).catch(err => {
  console.error('Failed to connect to Redis:', err);
});

// REST API routes for Context7
app.get('/get/:key', async (req, res) => {
  try {
    const value = await client.get(req.params.key);
    res.json({ data: value });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/set/:key', async (req, res) => {
  try {
    console.log('Set request received:', req.params.key, req.body);
    const { value } = req.body;
    const result = await client.set(req.params.key, value);
    res.json({ success: result === 'OK' });
  } catch (error) {
    console.error('Set error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/del/:key', async (req, res) => {
  try {
    const result = await client.del(req.params.key);
    res.json({ deleted: result > 0 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Context7 Redis bridge running on port ${port}`);
  console.log(`Redis REST URL: http://localhost:${port}`);
  console.log(`Redis REST Token: bridge-token-local-dev`);
});