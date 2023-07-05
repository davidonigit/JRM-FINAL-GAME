const tmx = require("tmx-parser");

async function loadMap() {
  const map = await new Promise((resolve, reject) => {
    tmx.parseFile("./src/map2.tmx", function (err, loadedMap) {
      if (err) return reject(err);
      resolve(loadedMap);
    });
  });

  const groundTiles = map.layers[0].tiles;
  const decalTiles = map.layers[1].tiles;
  const propTiles = map.layers[2].tiles
  const interactTiles = map.layers[3].tiles;
  const ground2D = [];
  const decal2D = [];
  const prop2D = [];
  const interact2D = [];

  for (let row = 0; row < map.height; row++) {
    const groundRow = [];
    const decalRow = [];
    const propRow = [];
    const interactRow = [];
    for (let col = 0; col < map.width; col++) {
      const groundTile = groundTiles[row * map.height + col];
      if (groundTile) {
        groundRow.push({
          id: groundTile.id,
          gid: groundTile.gid,
        });
      } else {
        groundRow.push(undefined)
      }

      const decalTile = decalTiles[row * map.height + col];
      if (decalTile) {
        decalRow.push({
          id: decalTile.id,
          gid: decalTile.gid,
        });
      } else {
        decalRow.push(undefined);
      }

      const propTile = propTiles[row * map.height + col];
      if (propTile) {
        propRow.push({
          id: propTile.id,
          gid: propTile.gid,
        });
      } else {
        propRow.push(undefined);
      }

      const interactTile = interactTiles[row * map.height + col];
      if (interactTile) {
        interactRow.push({
          id: interactTile.id,
          gid: interactTile.gid,
        });
      } else {
        interactRow.push(undefined);
      }
      
    }
    ground2D.push(groundRow);
    decal2D.push(decalRow);
    prop2D.push(propRow)
    interact2D.push(interactRow);
  }

  return {
    ground2D,
    decal2D,
    prop2D,
    interact2D,
  };
}

module.exports = loadMap;