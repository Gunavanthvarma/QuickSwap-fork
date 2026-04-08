# QuickSwap

This project modernizes traditional classified marketplaces by replacing chat-based price negotiations with a Real-Time Bidding (RTB) engine. Sellers list items with a soft starting price and a fixed bidding window, eliminating the need to manage multiple conversations while allowing the market to determine the final value automatically at auction close. Buyers participate in a transparent, competitive process where all bids are visible in real time, ensuring fair access and clear price discovery with no hidden commitments. By shifting from negotiation-driven chats to discovery-driven bidding, the platform compresses the lifecycle of a sale from days into minutes, bringing the efficiency and transparency of high-speed auction systems to local peer-to-peer marketplaces.

## Auth Setup (Supabase)

The app uses Supabase for authentication. To run locally:

1. Create a project at [supabase.com](https://supabase.com) and get your API credentials (Settings → API).
2. Copy `.env` and fill in:
   - `SUPABASE_URL` — your project URL (e.g. `https://xxx.supabase.co`)
   - `SUPABASE_ANON_KEY` — your anon/public key
3. run `docker-compose up -d redis`
4. execute `docker run --name quickswap-redis -p 6379:6379 -d redis:7-alpine`
5. Run the auth server:
   ```bash
   go run ./cmd/server
   ```
6. Open http://localhost:8082 in your browser.

## Frontend Setup

1. `cd frontend`
2. Run `npm install`
3.  set `VITE_API_BASE`=http://localhost:8082 in `frontend/.env` if you want to point to a remote backend
4. Start the frontend dev server:
   ```bash
   npm run dev
   ```
   This will launch the app at [http://localhost:5173]


## Unit Testing
For backend '''bash go test -v -cover ./... '''

For frontend 

```
cd frontend
npm i
npm run test 
npm run cypress:run
```

## Members

1. Krishna Niveditha Sudeep Kumar - Backend Developer
2. Gunavanth Varma Aduluru - Backend Developer
3. Rukaiya Khan - Frontend Developer
4. Vatsal Harish Shah - Frontend Developer
