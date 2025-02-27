import * as fs from "fs";
import csv from "csv-parser";
import { Item, Customer } from "./types";

export function readCustomerData(filePath: string): Promise<Customer[]> {
  return new Promise((resolve, reject) => {
    const customers: Customer[] = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (row) => {
        customers.push({ email: row.email });
      })
      .on("end", () => {
        resolve(customers);
      })
      .on("error", (error) => {
        reject(error);
      });
  });
}

export function readItemData(filePath: string): Promise<Item[]> {
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

