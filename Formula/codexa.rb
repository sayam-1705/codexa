class Codexa < Formula
  desc "Blame-aware pre-commit guardian with verified auto-fix"
  homepage "https://codexa-toolkit.vercel.app"
  url "https://github.com/sayam-1705/codexa/archive/refs/tags/v1.1.3.tar.gz"
  sha256 "2c846bb04a9a92e7b3f84e5bfb4b8c1a39409cbb226b17869b39b25efa0cdb7b"
  license "MIT"

  depends_on "node"

  def install
    system "npm", "install", "--production", *std_npm_args

    (bin/"codexa").write <<~EOS
      #!/bin/bash
      exec node "#{libexec}/bin/codexa.js" "$@"
    EOS
  end

  test do
    assert_match "1.1.3", shell_output("#{bin}/codexa --version")
  end
end
