class Codexa < Formula
  desc "AI pre-commit guardian with blame-awareness and auto-fix"
  homepage "https://codexa.dev"
  url "https://github.com/your-org/codexa/archive/refs/tags/v1.0.0.tar.gz"
  sha256 "REPLACE_WITH_RELEASE_TARBALL_SHA256"
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
    assert_match "1.0.0", shell_output("#{bin}/codexa --version")
  end
end
