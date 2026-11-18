import json
import os
import posixpath
import sys
import urllib.parse
from fetch_cc0_assets import OUT_ROOT, download_raw, fetch_github_tree


def main():
    os.makedirs(OUT_ROOT, exist_ok=True)
    extra = {"kaykit_nature": [], "quaternius_extra": []}

    # 1. KayKit Medieval Hexagon decoration/nature & decoration/props (trees, rocks, clouds)
    try:
        branch, tree = fetch_github_tree("KayKit-Game-Assets", "KayKit-Medieval-Hexagon-Pack-1.0")
        all_paths = [i["path"] for i in tree if i["type"] == "blob"]
        all_set = set(all_paths)
        dest = os.path.join(OUT_ROOT, "kaykit_medieval_hex")
        nature_models = [
            p for p in all_paths
            if "decoration/" in p and p.lower().endswith(".gltf")
        ]
        # Grab trees, rocks, props
        picked = [
            p for p in sorted(nature_models)
            if any(k in p.lower() for k in ("tree", "rock", "cloud", "banner", "bridge", "watertower", "tent"))
        ][:30]
        for mp in picked:
            lm = download_raw("KayKit-Game-Assets", "KayKit-Medieval-Hexagon-Pack-1.0", branch, mp, dest)
            extra["kaykit_nature"].append(lm)
            with open(lm, "r", encoding="utf-8") as f:
                gj = json.load(f)
            base_dir = posixpath.dirname(mp)
            for sec in ("buffers", "images"):
                for item in gj.get(sec, []):
                    uri = item.get("uri")
                    if uri and not uri.startswith("data:"):
                        rel = posixpath.normpath(posixpath.join(base_dir, uri))
                        if rel in all_set:
                            extra["kaykit_nature"].append(
                                download_raw("KayKit-Game-Assets", "KayKit-Medieval-Hexagon-Pack-1.0", branch, rel, dest)
                            )
        print(f"Downloaded {len(extra['kaykit_nature'])} KayKit nature files")
    except Exception as exc:
        print(f"kaykit_nature err: {exc}", file=sys.stderr)

    # 2. Quaternius Showcase: inspect pack folders specifically for nature/trees/robots/animals
    try:
        branch, tree = fetch_github_tree("trebeljahr", "quaternius-showcase")
        glbs = [i["path"] for i in tree if i["type"] == "blob" and i["path"].lower().endswith(".glb")]
        packs = sorted({p.split("/")[2] for p in glbs if len(p.split("/")) > 3})
        extra["quaternius_packs"] = packs
        dest = os.path.join(OUT_ROOT, "quaternius")

        targeted = []
        for p in sorted(glbs):
            low = p.lower()
            if any(k in low for k in (
                "tree_", "oak", "pine", "birch", "crystal", "mushroom", "shrub", "bush",
                "bear", "owl", "bird", "squirrel", "hedgehog", "beaver", "hedgehog",
                "robot", "drone", "flying", "spaceship", "cannon", "crossbow", "catapult", "castle"
            )):
                if "palmtree" in low:
                    continue
                targeted.append(p)
        for p in targeted[:55]:
            extra["quaternius_extra"].append(download_raw("trebeljahr", "quaternius-showcase", branch, p, dest))
        print(f"Downloaded {len(extra['quaternius_extra'])} Quaternius extra files across packs: {packs}")
    except Exception as exc:
        print(f"quaternius_extra err: {exc}", file=sys.stderr)

    out_path = os.path.join(OUT_ROOT, "manifest_extra.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(extra, f, indent=2)


if __name__ == "__main__":
    main()
