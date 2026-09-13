class Codexa < Formula
  desc "Blame-aware pre-commit guardian with verified auto-fix"
  homepage "https://codexa-toolkit.vercel.app"
  url "https://github.com/sayam-1705/codexa/archive/refs/tags/v1.1.1.tar.gz"
  sha256 "49b4e177059490eb143dfcb3de8850edd1c7fe86a3f25e3e66f0f3cfae932977"
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
    assert_match "1.1.1", shell_output("#{bin}/codexa --version")
  end
end
