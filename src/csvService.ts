import * as fs from "fs";
import csv from "csv-parser";
import { Item } from "./types";

export function readCSV(filePath: string): Promise<Item[]> {
  return new Promise((resolve, reject) => {
    const items: Item[] = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (row) => {
        items.push({
          id: row.id,
          name: row.name,
          price: parseFloat(row.price),
        });
      })
      .on("end", () => {
        resolve(items);
      })
      .on("error", (error) => {
        reject(error);
      });
  });
}
