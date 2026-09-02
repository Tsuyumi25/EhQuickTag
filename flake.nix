{
  description = "EhQuickTag development environment";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { self, nixpkgs }:
    let
      systems = [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ];
      forEachSystem = f: nixpkgs.lib.genAttrs systems (system: f nixpkgs.legacyPackages.${system});
    in
    {
      devShells = forEachSystem (pkgs: {
        default = pkgs.mkShell {
          packages = [
            pkgs.nodejs_22
            pkgs.pnpm
            pkgs.playwright-driver.browsers
          ];

          PLAYWRIGHT_BROWSERS_PATH = "${pkgs.playwright-driver.browsers}";
          PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = "true";

          shellHook = ''
            nixPlaywright=${pkgs.playwright-driver.version}
            npmPlaywright=$(${pkgs.jq}/bin/jq -r .version node_modules/@playwright/test/package.json 2>/dev/null)
            if [ -n "$npmPlaywright" ] && [ "$npmPlaywright" != "$nixPlaywright" ]; then
              echo "playwright 版本不一致：npm $npmPlaywright / nix $nixPlaywright" >&2
              echo "e2e 會找不到瀏覽器，跑 pnpm update @playwright/test 對齊" >&2
            fi
          '';
        };
      });
    };
}
