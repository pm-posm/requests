import { useState, useEffect } from 'react';
import Papa from 'papaparse';

export interface StoreData {
  "KA": string;
  "CUSTOMER": string;
  "STORE CODE": string;
  "STORE NAME": string;
  "REGION": string;
  "STORE LEVEL": string;
  "PROVINCE": string;
  "DISTRICT": string;
  "WARD": string;
  "ADDRESS": string;
  "MER NAME": string;
}

const CSV_URL = 'https://docs.google.com/spreadsheets/d/1Lct6U-pSOCpGUEGG_uDrjS5joQCJA4UvC66-QrkDKgE/export?format=csv&gid=1392312391';

// Caching the result in memory so we only fetch once per session
let cachedStores: StoreData[] | null = null;
let fetchPromise: Promise<StoreData[]> | null = null;

export function useStoresData() {
  const [data, setData] = useState<StoreData[]>(cachedStores || []);
  const [isLoading, setIsLoading] = useState<boolean>(!cachedStores);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cachedStores) {
      // Data is already loaded during initialization
      return;
    }

    if (!fetchPromise) {
      fetchPromise = new Promise((resolve, reject) => {
        Papa.parse(CSV_URL, {
          download: true,
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            if (results.errors.length > 0) {
              console.error('CSV Parsing errors:', results.errors);
            }
            const validData = (results.data as StoreData[]).filter(
              d => d["STORE CODE"] && d["STORE CODE"].trim() !== ''
            );
            cachedStores = validData;
            resolve(validData);
          },
          error: (err: Error) => {
            console.error(err);
            reject('Không thể tải dữ liệu từ Google Sheet. Vui lòng kiểm tra kết nối.');
          }
        });
      });
    }

    fetchPromise
      .then((validData) => {
        setData(validData);
        setIsLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
        setIsLoading(false);
      });
  }, []);

  return { data, isLoading, error };
}
