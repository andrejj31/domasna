const { Builder, By, until } = require('selenium-webdriver');
const cheerio = require('cheerio');
const axios = require('axios');


const url = `https://www.mse.mk/mk/stats/symbolhistory/grdn`;

async function fetchOptions() {
  const response = await axios.get(url);
  const $ = cheerio.load(response.data);

  const options = $('select[name="Code"] option');

  let newOptions = [];
  options.each((index, element) => {
    const optionText = $(element).text().trim();
    // Use regex to check if optionText contains any digits
    if (!/\d/.test(optionText)) {
      newOptions.push(optionText);
    }
  });

  return newOptions
}

async function scrapeMSE(tag="grnd", startDate, endDate) {
    let driver = await new Builder().forBrowser('chrome').build();
    try {
        const url = 'https://www.mse.mk/mk/stats/symbolhistory/${tag}';
        await driver.get(url);
        
        await driver.wait(until.elementLocated(By.css('input.datepicker')), 10000);

        const newStartDate = startDate; 
        const newEndDate = endDate

        let startDateInput = await driver.findElements(By.css('input.datepicker')).then(inputs => inputs[0]);
        await startDateInput.clear();
        await startDateInput.sendKeys(newStartDate);

        let endDateInput = await driver.findElements(By.css('input.datepicker')).then(inputs => inputs[1]);
        await endDateInput.clear();
        await endDateInput.sendKeys(newEndDate);

        await driver.findElement(By.css('input[value="Прикажи"]')).click();

        await driver.wait(until.elementLocated(By.css('table')), 10000);

        // Get the entire table's HTML
        const tableHTML = await driver.getPageSource();

        
        // Load the table HTML with Cheerio
        const $ = cheerio.load(tableHTML);

        const data = [];
        $('tr').each((i, row) => {
            const columns = $(row).find('td');
            if (columns.length) {
                const rowData = {
                    date: $(columns[0]).text().trim(),
                    price: $(columns[1]).text().trim(),
                    volume: $(columns[2]).text().trim(),
                };
                data.push(rowData);
            }
        });

        console.log('Data:', data);
        return data
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await driver.quit(); // Close the browser
    }
};

async function run() {
    const codes = await fetchOptions()
    console.log(codes)
    let arr = [];
    codes.forEach(async (code) => {
        arr = [...arr , await scrapeMSE(code,"2014.01.01", "2014.12.31")]
    });
    console.log(arr)
}

run()
