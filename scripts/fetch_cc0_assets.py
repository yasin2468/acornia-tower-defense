import json
import os
import posixpath
import ssl
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request

OUT_ROOT = "/tmp/palamut_cc0"
HEADERS = {"User-Agent": "PalamutKalesi-AssetFetcher/1.0"}


def http_get(url: str, timeout: int = 30) -> bytes:
    ca_file = "/etc/ssl/cert.pem"
    if os.path.exists(ca_file):
        try:
            ctx = ssl.create_default_context(cafile=ca_file)
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
                return resp.read()
        except urllib.error.HTTPError:
            raise
        except Exception:
            pass
    return subprocess.check_output(
        ["curl", "-fsSL", "--max-time", str(timeout), "-A", HEADERS["User-Agent"], url]
    )


def fetch_github_tree(owner: str, repo: str):
    for branch in ("main", "master"):
        url = f"https://api.github.com/repos/{owner}/{repo}/git/trees/{branch}?recursive=1"
        try:
            data = json.loads(http_get(url).decode("utf-8"))
            if "tree" in data:
                return branch, data["tree"]
        except (urllib.error.HTTPError, subprocess.CalledProcessError) as e:
            code = getattr(e, "code", None)
            if code == 404 or isinstance(e, subprocess.CalledProcessError):
                continue
            raise
    raise RuntimeError(f"Could not resolve branch for {owner}/{repo}")


def download_raw(owner: str, repo: str, branch: str, path: str, dest_dir: str) -> str:
    quoted = urllib.parse.quote(path)
    url = f"https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{quoted}"
    local_path = os.path.join(dest_dir, path)
    os.makedirs(os.path.dirname(local_path), exist_ok=True)
    if not os.path.exists(local_path) or os.path.getsize(local_path) == 0:
        data = http_get(url, timeout=45)
        with open(local_path, "wb") as f:
            f.write(data)
    return local_path


def fetch_kaykit_pack(owner: str, repo: str, dest_dir: str, include_keywords: list[str], max_models: int):
    downloaded = []
    branch, tree = fetch_github_tree(owner, repo)
    all_paths = [item["path"] for item in tree if item["type"] == "blob"]

    # Always grab shared textures (.png) inside gltf directories
    textures = [
        p for p in all_paths
        if p.lower().endswith((".png", ".jpg")) and ("gltf" in p.lower() or "texture" in p.lower())
    ]
    for tex in textures:
        downloaded.append(download_raw(owner, repo, branch, tex, dest_dir))

    # Pick relevant .gltf / .glb files
    model_files = [
        p for p in all_paths
        if p.lower().endswith((".gltf", ".glb")) and (
            not include_keywords or any(kw in p.lower() for kw in include_keywords)
        )
    ]

    # Deduplicate team colors where applicable: prefer blue/red/base variants
    picked = []
    for p in sorted(model_files):
        lower = p.lower()
        if any(c in lower for c in ("_yellow.", "_green.")) and not any(k in lower for k in ("tree", "bush")):
            continue
        picked.append(p)
        if len(picked) >= max_models:
            break

    all_set = set(all_paths)
    for mp in picked:
        local_model = download_raw(owner, repo, branch, mp, dest_dir)
        downloaded.append(local_model)
        if mp.lower().endswith(".gltf"):
            # Inspect buffers and images referenced by .gltf
            try:
                with open(local_model, "r", encoding="utf-8") as f:
                    gltf_json = json.load(f)
                base_dir = posixpath.dirname(mp)
                for buf in gltf_json.get("buffers", []):
                    uri = buf.get("uri")
                    if uri and not uri.startswith("data:"):
                        rel = posixpath.normpath(posixpath.join(base_dir, uri))
                        if rel in all_set:
                            downloaded.append(download_raw(owner, repo, branch, rel, dest_dir))
                for img in gltf_json.get("images", []):
                    uri = img.get("uri")
                    if uri and not uri.startswith("data:"):
                        rel = posixpath.normpath(posixpath.join(base_dir, uri))
                        if rel in all_set:
                            downloaded.append(download_raw(owner, repo, branch, rel, dest_dir))
            except Exception as exc:
                print(f"Warning inspecting {mp}: {exc}")

    return sorted(set(downloaded))


def fetch_quaternius_glbs(dest_dir: str):
    owner, repo = "trebeljahr", "quaternius-showcase"
    branch, tree = fetch_github_tree(owner, repo)
    glbs = [item["path"] for item in tree if item["type"] == "blob" and item["path"].lower().endswith(".glb")]

    wanted_tokens = [
        "bear", "squirrel", "fox", "owl", "stag", "deer", "wolf", "raccoon", "rabbit",
        "robot", "mech", "drone", "turret", "tower", "cannon", "tree", "oak", "pine",
        "rock", "cliff", "crystal", "chest", "lantern", "fence", "castle", "arch"
    ]
    picked = []
    for p in sorted(glbs):
        low = posixpath.basename(p).lower() + " " + p.lower()
        if any(tok in low for tok in wanted_tokens):
            # Skip overly huge packs or duplicates if count grows too high
            picked.append(p)
        if len(picked) >= 55:
            break

    downloaded = []
    for p in picked:
        downloaded.append(download_raw(owner, repo, branch, p, dest_dir))
    return downloaded


def fetch_kenney_td_kit(dest_dir: str):
    owner, repo = "ETdoFresh", "kenney.nl"
    branch, tree = fetch_github_tree(owner, repo)
    blobs = [item["path"] for item in tree if item["type"] == "blob"]
    td_files = [
        p for p in blobs
        if "tower-defense" in p.lower() and p.lower().endswith((".glb", ".gltf", ".bin", ".png"))
    ]
    # Limit to essential models + textures
    picked = sorted(td_files)[:60]
    downloaded = []
    for p in picked:
        downloaded.append(download_raw(owner, repo, branch, p, dest_dir))
    return downloaded


def main():
    os.makedirs(OUT_ROOT, exist_ok=True)
    manifest = {"sources": {}, "errors": {}}

    tasks = [
        (
            "kaykit_medieval_hexagon",
            lambda: fetch_kaykit_pack(
                "KayKit-Game-Assets",
                "KayKit-Medieval-Hexagon-Pack-1.0",
                os.path.join(OUT_ROOT, "kaykit_medieval_hex"),
                [
                    "watchtower", "archery", "barracks", "castle", "tower", "keep",
                    "tree", "rock", "mountain", "hill", "mill", "blacksmith", "lumber", "well", "bridge"
                ],
                40,
            ),
        ),
        (
            "kaykit_dungeon",
            lambda: fetch_kaykit_pack(
                "KayKit-Game-Assets",
                "KayKit-Dungeon-Remastered-1.0",
                os.path.join(OUT_ROOT, "kaykit_dungeon"),
                ["chest", "torch", "banner", "pillar", "column", "wall", "barrel", "crate", "arch", "gate"],
                35,
            ),
        ),
        (
            "quaternius_glb",
            lambda: fetch_quaternius_glbs(os.path.join(OUT_ROOT, "quaternius")),
        ),
        (
            "kenney_td",
            lambda: fetch_kenney_td_kit(os.path.join(OUT_ROOT, "kenney_td")),
        ),
    ]

    total = 0
    for key, fn in tasks:
        try:
            files = fn()
            manifest["sources"][key] = files
            total += len(files)
            print(f"[{key}] downloaded {len(files)} files")
        except Exception as exc:
            manifest["errors"][key] = str(exc)
            print(f"[{key}] error: {exc}", file=sys.stderr)

    manifest_path = os.path.join(OUT_ROOT, "manifest.json")
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
    print(f"Manifest written to {manifest_path} (total files: {total})")

    if total == 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
