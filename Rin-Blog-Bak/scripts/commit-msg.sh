#!/bin/sh

if ! bun check; then
    echo "TypeScript编译失败。请在提交前修复这些错误。"
    exit 1
fi

#!/bin/sh

# 获取 commit-msg 钩子传递的参数，即提交信息文件的路径
COMMIT_MSG_FILE="$1"
# 读取提交信息文件的内容
COMMIT_MSG=$(cat "$COMMIT_MSG_FILE")
# 检查提交信息格式
if ! echo "$COMMIT_MSG" | grep -E '^(feat|chore|fix|docs|ci|style|test|pref): ' > /dev/null; then
    echo "错误：提交消息必须以下列前缀之一开头：feat|chore|fix|docs|ci|style|test|pref"
    echo "请确保您的提交消息以这些前缀之一开头，后跟冒号和空格。"
    exit 1
fi

exit 0