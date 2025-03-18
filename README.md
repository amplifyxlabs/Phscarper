# Product Hunt Scraper

A tool for scraping Product Hunt for product launches and extracting contact information from makers and product websites.

## Features

- Scrapes Product Hunt leaderboard pages for top products
- Extracts product information including name, URL, and website
- Extracts maker information including email, Twitter/X handle, and LinkedIn URL
- Extracts contact information from product websites
- Exports data to CSV for easy analysis

## Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Create a `.env` file with your settings (see `.env.sample`)
4. Run the scraper: `node index.js`

## Configuration

Set the following environment variables in your `.env` file:

- `HEADLESS`: Run browser in headless mode (true/false)
- `MAX_PRODUCTS`: Maximum number of products to scrape
- `DELAY_BETWEEN_REQUESTS`: Delay in ms between requests
- `DEBUG_MODE`: Enable debug mode (true/false)
- `TARGET_URL`: Product Hunt URL to scrape
- `MAX_MAKERS_PER_PRODUCT`: Maximum number of makers to process per product
- `SKIP_COMMENTS`: Skip extraction from comments (true/false)

## License

MIT

## Important URLs

1. **Product Hunt Leaderboard**: https://www.producthunt.com/leaderboard/daily/2025/3/17/all
2. **GraphQL API**: https://www.producthunt.com/api/graphql
3. **Maker API Endpoint**: https://www.producthunt.com/@username
4. **Product API Endpoint**: https://www.producthunt.com/posts/:slug
5. **Product Redirect URLs**: https://www.producthunt.com/r/:id
6. **Developer API**: https://www.producthunt.com/v2/oauth/applications

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