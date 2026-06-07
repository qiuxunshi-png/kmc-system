{
  pkgs = import <nixpkgs> {};
  deps = [
    pkgs.nodejs_20
    pkgs.sqlite
  ];
}
