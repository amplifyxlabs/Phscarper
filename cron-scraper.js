// Cron Scraper Script for Product Hunt
// This script automatically updates the date in the TARGET_URL in .env
// and runs the scraper.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const dotenv = require('dotenv');
const { uploadCSVToGoogleSheets } = require('./google-sheets-exporter');

// Load current env variables
dotenv.config();
const envFilePath = path.join(__dirname, '.env');

// Function to update the date in TARGET_URL
function updateTargetUrl() {
  try {
    // Read current .env file
    const envContent = fs.readFileSync(envFilePath, 'utf8');
    
    // Extract current TARGET_URL
    const targetUrlMatch = envContent.match(/TARGET_URL=https:\/\/www\.producthunt\.com\/leaderboard\/daily\/(\d+)\/(\d+)\/(\d+)\/all/);
    
    if (!targetUrlMatch) {
      console.error('Could not find TARGET_URL in .env file');
      return false;
    }
    
    // Extract date components
    const year = parseInt(targetUrlMatch[1]);
    const month = parseInt(targetUrlMatch[2]);
    const day = parseInt(targetUrlMatch[3]);
    
    // Create date object and increment by one day
    const currentDate = new Date(year, month - 1, day); // Month is 0-indexed in JS
    currentDate.setDate(currentDate.getDate() + 1);
    
    // Format the new date
    const newYear = currentDate.getFullYear();
    const newMonth = currentDate.getMonth() + 1; // Month is 0-indexed
    const newDay = currentDate.getDate();
    
    // Create new TARGET_URL
    const newTargetUrl = `TARGET_URL=https://www.producthunt.com/leaderboard/daily/${newYear}/${newMonth}/${newDay}/all`;
    
    // Update the .env file
    const updatedEnvContent = envContent.replace(
      /TARGET_URL=https:\/\/www\.producthunt\.com\/leaderboard\/daily\/\d+\/\d+\/\d+\/all/,
      newTargetUrl
    );
    
    // Write updated content back to .env file
    fs.writeFileSync(envFilePath, updatedEnvContent);
    
    console.log(`Updated TARGET_URL to use date: ${newYear}/${newMonth}/${newDay}`);
    return true;
  } catch (error) {
    console.error(`Error updating TARGET_URL: ${error.message}`);
    return false;
  }
}

// Function to find the latest CSV file
function findLatestCSV(directory) {
  const files = fs.readdirSync(directory);
  let latestCsvFile = null;
  let latestTime = 0;
  
  files.forEach(file => {
    if (file.startsWith('product_hunt_data_') && file.endsWith('.csv')) {
      const filePath = path.join(directory, file);
      const stats = fs.statSync(filePath);
      
      if (stats.mtime.getTime() > latestTime) {
        latestTime = stats.mtime.getTime();
        latestCsvFile = filePath;
      }
    }
  });
  
  return latestCsvFile;
}

// Main function
async function main() {
  console.log('Starting cron-scraper...');
  
  // Update the TARGET_URL in .env
  const updated = updateTargetUrl();
  
  if (!updated) {
    console.error('Failed to update TARGET_URL, exiting...');
    process.exit(1);
  }
  
  // Run the main scraper
  console.log('Running main scraper...');
  try {
    execSync('node index.js', { stdio: 'inherit' });
    console.log('Scraper finished successfully!');
    
    // Export to Google Sheets if configuration is available
    if (process.env.GOOGLE_SHEET_ID) {
      console.log('Exporting data to Google Sheets...');
      
      // Find the latest CSV file
      const latestCsvFile = findLatestCSV(__dirname);
      
      if (latestCsvFile) {
        console.log(`Latest CSV file found: ${latestCsvFile}`);
        await uploadCSVToGoogleSheets(latestCsvFile);
      } else {
        console.error('No CSV file found to export');
      }
    } else {
      console.log('Google Sheets export skipped (GOOGLE_SHEET_ID not found in environment variables)');
    }
  } catch (error) {
    console.error(`Error running scraper: ${error.message}`);
    process.exit(1);
  }
}

// Run the main function
main();