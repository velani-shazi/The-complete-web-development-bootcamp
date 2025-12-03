import express from "express";
import axios from "axios";
import bodyParser from "body-parser";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = 3000;

const API_URL = "https://financialmodelingprep.com/stable";
const API_KEY = process.env.API_KEY; 

app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");

async function makeAPIRequest(endpoint, params = {}) {
  try {
    console.log(API_URL, endpoint);

    if (endpoint === '/sector-performance-snapshot') {
      const today = new Date().toISOString().split('T')[0]; // e.g. 2025-11-04
      params.date = today;
    }

    const response = await axios.get(`${API_URL}${endpoint}`, {
      params: {
        ...params,
        apikey: API_KEY
      }
    });

    return response.data;
  } catch (error) {
    console.error(`API Error for ${endpoint}:`, error.message);
    throw error;
  }
}

app.get("/", (req, res) => {
  res.render("index", { 
    stockData: null, 
    error: null,
    searchPerformed: false 
  });
});

app.post("/search", async (req, res) => {
  const symbol = req.body.symbol.toUpperCase();
  
  try {
    const [profile, quote, keyMetrics, ratios] = await Promise.all([
      makeAPIRequest("/profile", { symbol }),
      makeAPIRequest("/quote", { symbol }),
      makeAPIRequest("/key-metrics-ttm", { symbol }),
      makeAPIRequest("/ratios-ttm", { symbol })
    ]);

    if (!profile || profile.length === 0) {
      throw new Error("Stock symbol not found");
    }

    const stockData = {
      profile: profile[0],
      quote: quote[0],
      keyMetrics: keyMetrics[0],
      ratios: ratios[0]
    };

    res.render("index", { 
      stockData, 
      error: null,
      searchPerformed: true 
    });
  } catch (error) {
    res.render("index", { 
      stockData: null, 
      error: `Error: ${error.message}. Please check the symbol and try again.`,
      searchPerformed: true 
    });
  }
});

app.get("/market", async (req, res) => {
  try {
    const [gainers, losers, actives, sectorPerformance] = await Promise.all([
      makeAPIRequest("/biggest-gainers"),
      makeAPIRequest("/biggest-losers"),
      makeAPIRequest("/most-actives"),
      makeAPIRequest("/sector-performance-snapshot")
    ]);

    res.render("market", { 
      gainers: gainers.slice(0, 10),
      losers: losers.slice(0, 10),
      actives: actives.slice(0, 10),
      sectorPerformance,
      error: null 
    });
  } catch (error) {
    res.render("market", { 
      gainers: [],
      losers: [],
      actives: [],
      sectorPerformance: [],
      error: "Unable to fetch market data. Please try again later." 
    });
  }
});

app.get("/news", async (req, res) => {
  try {
    const news = await makeAPIRequest("/news/stock-latest", { limit: 20 });
    
    res.render("news", { 
      news,
      error: null 
    });
  } catch (error) {
    res.render("news", { 
      news: [],
      error: "Unable to fetch news. Please try again later." 
    });
  }
});

app.get("/compare", (req, res) => {
  res.render("compare", { 
    comparison: null,
    error: null 
  });
});

app.post("/compare", async (req, res) => {
  const symbol1 = req.body.symbol1.toUpperCase();
  const symbol2 = req.body.symbol2.toUpperCase();
  
  try {
    const [profile1, quote1, metrics1, profile2, quote2, metrics2] = await Promise.all([
      makeAPIRequest("/profile", { symbol: symbol1 }),
      makeAPIRequest("/quote", { symbol: symbol1 }),
      makeAPIRequest("/key-metrics-ttm", { symbol: symbol1 }),
      makeAPIRequest("/profile", { symbol: symbol2 }),
      makeAPIRequest("/quote", { symbol: symbol2 }),
      makeAPIRequest("/key-metrics-ttm", { symbol: symbol2 })
    ]);

    if (!profile1[0] || !profile2[0]) {
      throw new Error("One or both stock symbols not found");
    }

    const comparison = {
      company1: {
        profile: profile1[0],
        quote: quote1[0],
        metrics: metrics1[0]
      },
      company2: {
        profile: profile2[0],
        quote: quote2[0],
        metrics: metrics2[0]
      }
    };

    res.render("compare", { 
      comparison,
      error: null 
    });
  } catch (error) {
    res.render("compare", { 
      comparison: null,
      error: `Error: ${error.message}. Please check the symbols and try again.` 
    });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  console.log(`Visit http://localhost:${port} to view the application`);
});