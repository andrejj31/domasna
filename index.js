import * as cheerio from "cheerio";
import axios from "axios";
import fs from "fs";
import { fileURLToPath } from "url";
import { dirname } from "path";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const RWPATH = path.join(__dirname, "data.json");
const url = `https://www.mse.mk/mk/stats/symbolhistory/grdn`;

async function fetchOptions() {
  const response = await axios.get(url);
  const $ = cheerio.load(response.data);

  const options = $('select[name="Code"] option');

  let newOptions = [];
  options.each((index, element) => {
    const optionText = $(element).text().trim();
    if (!/\d/.test(optionText)) {
      newOptions.push(optionText);
    }
  });
}

async function fetchData(code, startDate, endDate) {
  const response = await axios.post(url, {
    fromDate: startDate,
    ToDate: endDate,
    Code: code,
  });
  const $ = cheerio.load(response.data);

  const data = [];
  $("tr").each((i, row) => {
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

  const finalData = {
    pocetenDatum: startDate,
    kraenDatum: endDate,
    code: code,
    data: data,
  };
  //   console.log(finalData);
}

// fetchData("ADIN", "01.01.2014", "31.12.2014");

function readFile() {
  if (fs.existsSync(RWPATH)) {
    const data = fs.readFileSync(RWPATH);
    return JSON.parse(RWPATH);
  }
  return { codes: {} };
}

function writeData(data) {
  fs.writeFileSync(RWPATH, JSON.stringify(data, null, 2), "utf8");
}
