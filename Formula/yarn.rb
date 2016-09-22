VERSION = "0.13.4"
HASH = "c073f012d0c01fb77f08034d5ce919498b9df7a6820b0d66dd20363d94a8d005"

class Yarn < Formula
  desc "JavaScript package manager"
  homepage "https://yarnpkg.io"
  url "https://github-cloud.s3.amazonaws.com/releases/49970642/c06b57c6-8016-11e6-816d-8fd96177b1f2.gz?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAISTNZFOVBIJMK3TQ%2F20160922%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20160922T130113Z&X-Amz-Expires=300&X-Amz-Signature=852811ef5880e0257f00e2c3a6e94327c8d3c9ffd6a8ee035eeaa64006b2d120&X-Amz-SignedHeaders=host&actor_id=853712&response-content-disposition=attachment%3B%20filename%3Dkpm-v0.13.4.tar.gz&response-content-type=application%2Foctet-stream" #{}"https://github.com/yarnpkg/yarn/releases/download/v#{VERSION}/kpm-v#{VERSION}.tar.gz"
  version VERSION
  sha256 HASH
  head "https://github.com/yarnpkg/yarn.git"

  depends_on "node" => :build

  def install
    bin.install "bin/yarn.js" => "yarn"
  end

  test do
    assert_match VERSION, shell_output("#{bin}/yarn -V").strip
  end
end
