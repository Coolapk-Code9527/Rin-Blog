#!/bin/sh

if ! bun check; then
    echo "TypeScript compilation failed. Please fix these errors before committing."
    exit 1
fi

#!/bin/sh

# 获取 commit-msg 钩子传递的参数，即提交信息文件的路径
COMMIT_MSG_FILE="$1"
# 读取提交信息文件的内容
COMMIT_MSG=$(cat "$COMMIT_MSG_FILE")
# Check commit message format
if ! echo "$COMMIT_MSG" | grep -E '^(feat|chore|fix|docs|ci|style|test|pref): ' > /dev/null; then
    echo "Error: Commit message must start with one of the following prefixes: feat|chore|fix|docs|ci|style|test|pref"
    echo "Please ensure your commit message starts with one of these prefixes, followed by a colon and space."
    exit 1
fi

exit 0