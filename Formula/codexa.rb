class Codexa < Formula
  desc "Blame-aware pre-commit guardian with verified auto-fix"
  homepage "https://codexa-toolkit.vercel.app"
  url "https://github.com/sayam-1705/codexa/archive/refs/tags/v1.1.4.tar.gz"
  sha256 "80d1bd34092c6d80e266bba76a92011ae2bad6ccc278635e519ab1710689d879"
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
    assert_match "1.1.4", shell_output("#{bin}/codexa --version")
  end
end
