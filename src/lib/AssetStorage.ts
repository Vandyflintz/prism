import { PrismAsset } from '../../types/prism';

const DB_NAME = 'prism-db';
const STORE_NAME = 'media-assets';
const DB_VERSION = 1;

export interface StoredAsset {
    id: string;
    asset: PrismAsset;
    blob: Blob;
    timestamp: number;
}

export class AssetStorage {
    private static db: IDBDatabase | null = null;

    static async init(): Promise<void> {
        if (this.db) return;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                }
            };

            request.onsuccess = (event) => {
                this.db = (event.target as IDBOpenDBRequest).result;
                resolve();
            };

            request.onerror = (event) => {
                console.error('AssetStorage DB Error:', (event.target as IDBOpenDBRequest).error);
                reject((event.target as IDBOpenDBRequest).error);
            };
        });
    }

    static async saveAsset(asset: PrismAsset, blob: Blob): Promise<void> {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);

            // We store the asset metadata AND the blob separately?
            // Or just store the whole object with the blob embedded?
            // The PrismAsset has a 'src' which is a blob URL. We shouldn't store the blob URL string as permanent.
            // We should store the blob, and on retrieval generate a new blob URL.

            const storedData: StoredAsset = {
                id: asset.id,
                asset: { ...asset, src: '' }, // Clear ephemeral URL
                blob: blob,
                timestamp: Date.now()
            };

            const request = store.put(storedData);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    static async getAllAssets(): Promise<StoredAsset[]> {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();

            request.onsuccess = () => {
                resolve(request.result as StoredAsset[]);
            };
            request.onerror = () => reject(request.error);
        });
    }

    static async deleteAsset(id: string): Promise<void> {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
}
