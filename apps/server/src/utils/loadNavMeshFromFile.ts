///////////////////////////////////////////////////////////
// CAPTAIN OBVIOUS HERE:
// this can only be used in a NODE ENVIRONMENT, do not use to import in the client as fs is not available.

import fs from "fs";
import path from "path";
import { NavMeshLoader, NavMesh } from "../../../shared/Libs/yuka-min";

export default async function loadNavMeshFromFile(fileNameNavMesh: string): Promise<NavMesh> {
    const url = path.join(process.cwd(), "public/navmesh/" + fileNameNavMesh + ".glb");
    const data = await fs.readFileSync(url);
    // Node Buffers for small files share a pooled ArrayBuffer with byteOffset > 0.
    // Yuka reads from offset 0 of the ArrayBuffer, so we must slice a clean copy.
    const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    const loader = new NavMeshLoader();
    return loader.parse(arrayBuffer, "", { mergeConvexRegions: false }).then((navmesh) => {
        return navmesh;
    });
}
