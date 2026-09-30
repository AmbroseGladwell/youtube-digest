{
  description = "The Overview: one dev shell with the tools the repo is built and run with";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { self, nixpkgs }:
    let
      systems = [ "aarch64-darwin" "x86_64-darwin" "x86_64-linux" "aarch64-linux" ];
      # bws carries Bitwarden's own licence, which nixpkgs marks unfree; it is the one package
      # allowed through (docs/conventions/secrets.md).
      pkgsFor = system: import nixpkgs {
        inherit system;
        config.allowUnfreePredicate = pkg: builtins.elem (nixpkgs.lib.getName pkg) [ "bws" ];
      };
      forEachSystem = f: nixpkgs.lib.genAttrs systems (system: f (pkgsFor system));
    in
    {
      devShells = forEachSystem (pkgs: {
        default = pkgs.mkShell {
          packages = [
            pkgs.nodejs_22
            pkgs.go-task
            pkgs.postgresql_17
            pkgs.bws
            pkgs.gitleaks
            pkgs.flyctl
            pkgs.jq
            pkgs.zip
            pkgs.unzip
            pkgs.python312
            pkgs.uv
            pkgs.ffmpeg-headless
            pkgs.espeak-ng
          ];
          # services/tts: uv uses this Python rather than downloading one, and Kokoro's
          # phonemiser uses this espeak-ng, whose bundled copy cannot find its data on macOS
          # (docs/conventions/tts-testing-guide.md).
          UV_PYTHON = "${pkgs.python312}/bin/python3";
          UV_PYTHON_DOWNLOADS = "never";
          PHONEMIZER_ESPEAK_LIBRARY = "${pkgs.espeak-ng}/lib/libespeak-ng${pkgs.stdenv.hostPlatform.extensions.sharedLibrary}";
          ESPEAK_DATA_PATH = "${pkgs.espeak-ng}/share/espeak-ng-data";
        };
      });
    };
}
