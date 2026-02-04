"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadProjectPackage = exports.saveProjectPackage = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const adm_zip_1 = __importDefault(require("adm-zip"));
const saveProjectPackage = async (savePath, data) => {
    try {
        const zip = new adm_zip_1.default();
        // We will modify the assets object to point to relative paths inside the zip
        const assetsToSave = { ...data.assets };
        const assetIds = Object.keys(assetsToSave);
        for (const id of assetIds) {
            const asset = { ...assetsToSave[id] };
            const originalSrc = asset.src;
            // We expect all assets to be file:// paths by the time they reach here
            // (Frontend should have staged them if they were blobs)
            let filePath = originalSrc;
            if (filePath.startsWith('file://')) {
                filePath = filePath.replace('file://', '');
            }
            filePath = decodeURIComponent(filePath);
            if (fs.existsSync(filePath)) {
                // Add to zip under 'assets/'
                const filename = path.basename(filePath);
                zip.addLocalFile(filePath, 'assets');
                // Update the src in the persisted JSON to be relative
                asset.src = `assets/${filename}`;
                assetsToSave[id] = asset;
            }
            else {
                console.warn(`[Persistence] Asset file not found: ${filePath}, skipping...`);
            }
        }
        // Create the project payload
        const projectPayload = {
            version: "1.0.0",
            project: data.project,
            assets: assetsToSave
        };
        const jsonContent = JSON.stringify(projectPayload, null, 2);
        zip.addFile("project.json", Buffer.from(jsonContent, "utf8"));
        // Write Zip
        zip.writeZip(savePath);
        console.log(`[Persistence] Saved project to ${savePath}`);
        return true;
    }
    catch (error) {
        console.error('[Persistence] Failed to save project:', error);
        throw error;
    }
};
exports.saveProjectPackage = saveProjectPackage;
const loadProjectPackage = async (filePath) => {
    try {
        const zip = new adm_zip_1.default(filePath);
        // Extract to a unique temp directory
        const projectTempId = `prism-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const extractPath = path.join(os.tmpdir(), 'prism-projects', projectTempId);
        if (!fs.existsSync(extractPath)) {
            fs.mkdirSync(extractPath, { recursive: true });
        }
        zip.extractAllTo(extractPath, true);
        console.log(`[Persistence] Extracted project to ${extractPath}`);
        // Read project.json
        const jsonPath = path.join(extractPath, 'project.json');
        if (!fs.existsSync(jsonPath)) {
            throw new Error("Invalid Project File: project.json missing");
        }
        const jsonContent = fs.readFileSync(jsonPath, 'utf-8');
        const data = JSON.parse(jsonContent);
        // Re-hydrate asset paths to absolute file:// paths
        const rehydratedAssets = { ...data.assets };
        const assetIds = Object.keys(rehydratedAssets);
        for (const id of assetIds) {
            const asset = rehydratedAssets[id];
            // asset.src is likely "assets/foo.png"
            if (asset.src && !asset.src.startsWith('http') && !asset.src.startsWith('data:')) {
                // Assume relative path
                const absolutePath = path.join(extractPath, asset.src);
                // Check if it exists?
                if (fs.existsSync(absolutePath)) {
                    asset.src = `file://${absolutePath}`;
                }
            }
            rehydratedAssets[id] = asset;
        }
        return {
            project: data.project,
            assets: rehydratedAssets
        };
    }
    catch (error) {
        console.error('[Persistence] Failed to load project:', error);
        throw error;
    }
};
exports.loadProjectPackage = loadProjectPackage;
