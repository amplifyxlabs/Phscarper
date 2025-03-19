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
    
    // Get the current date to determine if we should use today or tomorrow
    const now = new Date();
    const currentHour = now.getHours();
    
    // Extract current TARGET_URL
    const targetUrlMatch = envContent.match(/TARGET_URL=https:\/\/www\.producthunt\.com\/leaderboard\/daily\/(\d+)\/(\d+)\/(\d+)\/all/);
    
    // Determine which date to use for the URL
    let targetDate;
    
    if (!targetUrlMatch) {
      console.log('TARGET_URL not found in .env file, creating a new one');
      
      // Always use today's date
      targetDate = new Date(now);
      // No time-based condition, always use today's date
    } else {
      // Extract date components from existing URL
      const year = parseInt(targetUrlMatch[1]);
      const month = parseInt(targetUrlMatch[2]);
      const day = parseInt(targetUrlMatch[3]);
      
      // Create the date object from the URL
      const urlDate = new Date(year, month - 1, day); // Month is 0-indexed in JS
      
      // Get today's date with time set to 00:00:00
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      // Always use today's date if URL date is today or in the past
      // If the URL date is in the future, keep using that date
      
      if (urlDate.getTime() === today.getTime() || urlDate.getTime() < today.getTime()) {
        // URL date is today or in the past, always use today's date
        targetDate = new Date(today);
        // No time-based condition, always use today's date
      } else {
        // URL date is in the future, keep using it
        targetDate = new Date(urlDate);
      }
    }
    
    // Format the new date
    const newYear = targetDate.getFullYear();
    const newMonth = targetDate.getMonth() + 1; // Month is 0-indexed
    const newDay = targetDate.getDate();
    
    // Create new TARGET_URL with properly formatted date (no leading zeros)
    const newTargetUrl = `TARGET_URL=https://www.producthunt.com/leaderboard/daily/${newYear}/${newMonth}/${newDay}/all`;
    
    // Update or add the TARGET_URL in the .env file
    let updatedEnvContent;
    if (targetUrlMatch) {
      // Replace existing TARGET_URL
      updatedEnvContent = envContent.replace(
        /TARGET_URL=https:\/\/www\.producthunt\.com\/leaderboard\/daily\/\d+\/\d+\/\d+\/all/,
        newTargetUrl
      );
    } else {
      // Add new TARGET_URL if it doesn't exist
      updatedEnvContent = envContent + '\n' + newTargetUrl;
    }
    
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
  console.log(`Current time: ${new Date().toLocaleString()}`);
  
  // Update the TARGET_URL in .env
  const updated = updateTargetUrl();
  
  if (!updated) {
    console.error('Failed to update TARGET_URL, exiting...');
    process.exit(1);
  }
  
  // Reload environment variables after updating .env
  dotenv.config();
  
  // Run the main scraper
  console.log(`Running main scraper with TARGET_URL: ${process.env.TARGET_URL}`);
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
        try {
          await uploadCSVToGoogleSheets(latestCsvFile);
          console.log('Data successfully exported to Google Sheets');
        } catch (exportError) {
          console.error(`Error exporting to Google Sheets: ${exportError.message}`);
          // Continue execution even if export fails
        }
      } else {
        console.error('No CSV file found to export');
      }
    } else {
      console.log('Google Sheets export skipped (GOOGLE_SHEET_ID not found in environment variables)');
    }
    
    console.log(`Cron job completed successfully at ${new Date().toLocaleString()}`);
  } catch (error) {
    console.error(`Error running scraper: ${error.message}`);
    process.exit(1);
  }
}

// Run the main function
main(); 