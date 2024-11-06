import * as cheerio from "cheerio";
import axios from "axios";
import fs from "fs";

const url = `https://www.mse.mk/mk/stats/symbolhistory/grdn`;

// Filter 1: Fetch Issuers
async function fetchIssuers() {
  const response = await axios.get(url);
  const $ = cheerio.load(response.data);
  const options = $('select[name="Code"] option');

  let issuers = [];
  options.each((index, element) => {
    const optionText = $(element).text().trim();
    if (!/\d/.test(optionText)) {
      // Exclude entries containing digits
      issuers.push(optionText);
    }
  });

  return issuers; // Returns an array of issuer codes
}

// Filter 2: Check Last Data Date
async function checkLastDataDate(code) {
  // Check if the JSON file exists
  if (!fs.existsSync("data.json")) {
    return null; // Return null if the file doesn't exist
  }

  try {
    const data = JSON.parse(fs.readFileSync("data.json", "utf-8")); // Load existing data

    // Find the last date for the given issuer code
    const issuerData = data.find((item) => item.code === code);
    if (issuerData && issuerData.data.length > 0) {
      const lastDate = issuerData.data[issuerData.data.length - 1].datum; // Get the last date
      return lastDate; // Return the last available date
    }
  } catch (error) {
    console.error("Error reading JSON data:", error);
    return null; // Return null on error
  }

  return null; // Return null if no data found
}

// Filter 3: Fetch Missing Data
async function fetchMissingData(code, startDate, endDate) {
  const response = await axios.post(url, {
    fromDate: startDate,
    ToDate: endDate,
    Code: code,
  });

  const $ = cheerio.load(response.data);

  // Check if the "No data" message is present on the page
  if ($(".no-results").length > 0) {
    console.log($(".no-results"));
    return; // Skip further processing if no data message is found
  }

  const data = [];
  const rows = $("tr");

  rows.each((i, row) => {
    const columns = $(row).find("td");

    if (columns.length) {
      const rowData = {};
      const keys = [
        "datum",
        "poslednaTransakcija",
        "max",
        "min",
        "avg",
        "prom",
        "kolicina",
        "prometBEST",
        "vkupenPromet",
      ];
      columns.each((j, column) => {
        rowData[`${keys[j]}`] = $(column).text().trim();
      });
      data.push(rowData);
    }
  });

  return data; // Returns an array of new data for the issuer
}
// Filter 4: Store Data
function storeData(code, newData) {
  let existingData = [];

  // Load existing data if available
  if (fs.existsSync("data.json")) {
    try {
      existingData = JSON.parse(fs.readFileSync("data.json", "utf-8"));
    } catch (error) {
      console.error("Error reading JSON data for storing:", error);
    }
  }

  // Find the issuer in existing data or create a new entry
  const issuerIndex = existingData.findIndex((item) => item.code === code);
  if (issuerIndex !== -1) {
    // If the issuer exists, concatenate new data
    existingData[issuerIndex].data =
      existingData[issuerIndex].data.concat(newData);
  } else {
    // If the issuer doesn't exist, add it to the list
    existingData.push({
      code: code,
      data: newData,
    });
  }

  // Save the updated data back to the file
  fs.writeFileSync("data.json", JSON.stringify(existingData, null, 2));
}

// Main function to orchestrate the pipeline
async function main() {
  const issuers = await fetchIssuers(); // Step 1: Fetch issuers
  for (const code of issuers) {
    const lastDate = await checkLastDataDate(code); // Step 2: Check last data date
    const currentYear = new Date().getFullYear();
    const startYear = lastDate ? new Date(lastDate).getFullYear() + 1 : 2014; // Start from the next year after the last date
    const endYear = currentYear; // Up to the current year

    // Loop through each year and fetch data
    for (let year = startYear; year <= endYear; year++) {
      const startDate = `01.01.${year}`; // Start of the year
      const endDate = `31.12.${year}`; // End of the year

      const newData = await fetchMissingData(code, startDate, endDate); // Step 3: Fetch missing data for the year

      // Only store data if newData is not undefined and contains data
      if (newData && newData.length > 0) {
        storeData(code, newData); // Step 4: Store data
      }
    }
  }
}

main();
