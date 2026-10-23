# Dev shell: `nix-shell`, then `npm run dev` (http://localhost:5173)
{ pkgs ? import <nixpkgs> { } }:

pkgs.mkShell {
  packages = [ pkgs.nodejs_22 ];

  shellHook = ''
    # first time in: install the dependencies from the lockfile
    [ -d node_modules ] || npm ci --no-audit --no-fund
    echo "dev shell: npm run dev | npm run build | npm run preview"
  '';
}
