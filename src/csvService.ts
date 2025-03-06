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
    const itemMap: { [name: string]: { total: number; count: number } } = {};
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (row) => {
        const name = row.name;
        const price = parseFloat(row.price);
        if (!isNaN(price)) {
          if (itemMap[name]) {
            itemMap[name].total += price;
            itemMap[name].count += 1;
          } else {
            itemMap[name] = { total: price, count: 1 };
          }
        }
      })
      .on("end", () => {
        const items: Item[] = Object.keys(itemMap).map((name) => ({
          id: "",
          name: name || "N/A",
          price: isNaN(itemMap[name].total / itemMap[name].count)
            ? 0
            : parseFloat(
                (itemMap[name].total / itemMap[name].count).toFixed(2)
              ),
        }));
        resolve(items);
      })
      .on("error", (error) => {
        reject(error);
      });
  });
}
