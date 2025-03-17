# Product Hunt Scraper

A web scraper to extract product and maker information from Product Hunt, including emails, Twitter handles, and LinkedIn profiles.

## Important URLs

1. **Product Hunt Leaderboard**: https://www.producthunt.com/leaderboard/daily/2025/3/17/all
2. **GraphQL API**: https://www.producthunt.com/api/graphql
3. **Maker API Endpoint**: https://www.producthunt.com/@username
4. **Product API Endpoint**: https://www.producthunt.com/posts/:slug
5. **Product Redirect URLs**: https://www.producthunt.com/r/:id
6. **Developer API**: https://www.producthunt.com/v2/oauth/applications

## Features

- Scrapes product information from Product Hunt leaderboard
- Extracts maker contact information (email, Twitter, LinkedIn)
- Detects and follows redirects to product websites
- **NEW**: Extracts contact information from product websites (email, Twitter, LinkedIn, contact pages)
- Saves data in CSV format
- Captures API endpoints for further exploration

## Installation

1. Clone this repository
2. Install dependencies:

```bash
npm install
```

3. Configure the scraper by editing the `.env` file:

```
# Target URL to scrape (Product Hunt leaderboard)
TARGET_URL=https://www.producthunt.com/leaderboard/daily/2025/3/17/all

# Maximum number of products to scrape
MAX_PRODUCTS=30

# Delay between requests in milliseconds (to avoid rate limiting)
DELAY_BETWEEN_REQUESTS=2000

# Run in headless mode (true/false)
HEADLESS=false

# Enable debug mode for additional output (true/false)
DEBUG_MODE=true

# Maximum number of makers to scrape per product
MAX_MAKERS_PER_PRODUCT=4

# Skip comment sections
SKIP_COMMENTS=true
```

## Usage

Run the scraper with default settings:

```bash
npm start
```

Run in debug mode:

```bash
npm run debug
```

Run in headless mode:

```bash
npm run headless
```

## Output

The scraper will generate the following files:

1. `product_hunt_data_YYYY-MM-DD.csv`: CSV file containing all scraped data
2. `product_hunt_api_endpoints.json`: JSON file containing identified GraphQL API endpoints
3. `product_hunt_api_info.txt`: Text file containing API authentication information

## CSV Format

The CSV file contains the following columns:

- Product Name
- Product URL
- Product Website
- Maker Name
- Maker URL
- Email
- X (Twitter) ID
- LinkedIn URL
- Website Email
- Website Twitter
- Website LinkedIn
- Website Contact Page

## How It Works

The scraper performs the following steps:

1. Scrapes the Product Hunt leaderboard to get a list of products
2. For each product, extracts the product details and maker information
3. For each maker, extracts their contact information from their Product Hunt profile
4. **NEW**: For each product website, visits the site and extracts contact information from the footer or other sections
5. Saves all the collected data to a CSV file

## Notes

- Be respectful and follow Product Hunt's [terms of service](https://www.producthunt.com/terms)
- Add delays between requests to avoid rate limiting
- Use the scraper responsibly and only for legitimate purposes 