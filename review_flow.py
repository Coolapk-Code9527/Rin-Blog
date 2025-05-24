# review_flow.py
import sys
import os
import json
import time
import re
import glob
import shutil
from datetime import datetime

class WorkflowState:
    def __init__(self):
        self.mode = "standby"  # standby, planning, working
        self.step = 0
        self.task_complete = False
        self.history = []
        self.project_structure = {}
        self.tech_stack = {}
        self.config_cache = {}
        self.current_task = ""
        self.interactive_points = []  # 交互点列表：规划节点、执行节点、审查节点
        self.pending_feedback = False  # 是否等待用户反馈
        self.auto_sync = True  # 是否自动同步到文档

    def to_json(self):
        return json.dumps({
            "mode": self.mode,
            "step": self.step,
            "task_complete": self.task_complete,
            "history": self.history,
            "project_structure": self.project_structure,
            "tech_stack": self.tech_stack,
            "config_cache": self.config_cache,
            "current_task": self.current_task,
            "interactive_points": self.interactive_points,
            "pending_feedback": self.pending_feedback,
            "auto_sync": self.auto_sync
        }, indent=2)

    @classmethod
    def from_json(cls, json_str):
        state = cls()
        try:
            data = json.loads(json_str)
            state.mode = data.get("mode", "standby")
            state.step = data.get("step", 0)
            state.task_complete = data.get("task_complete", False)
            state.history = data.get("history", [])
            state.project_structure = data.get("project_structure", {})
            state.tech_stack = data.get("tech_stack", {})
            state.config_cache = data.get("config_cache", {})
            state.current_task = data.get("current_task", "")
            state.interactive_points = data.get("interactive_points", [])
            state.pending_feedback = data.get("pending_feedback", False)
            state.auto_sync = data.get("auto_sync", True)
        except Exception as e:
            print(f"状态解析错误: {e}", file=sys.stderr)
        return state

    def add_history(self, input_text, sync_to_docs=True):
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        entry = {"time": timestamp, "input": input_text, "mode": self.mode}
        self.history.append(entry)
        
        # 如果启用自动同步且需要同步到文档
        if sync_to_docs and self.auto_sync:
            self.sync_to_documents(input_text)
    
    def sync_to_documents(self, input_text):
        """根据当前模式将用户输入同步到相应文档区域"""
        try:
            if self.mode == "planning":
                update_working_doc_section("用户需求", input_text)
            elif self.mode == "working":
                if "修改" in input_text or "更新" in input_text or "调整" in input_text:
                    update_working_doc_section("工作计划", input_text)
                else:
                    update_working_doc_section("工作任务", input_text)
            
            # 重要反馈同时同步到develop.md
            if any(keyword in input_text for keyword in ["重要", "关键", "核心", "优先"]):
                update_develop_doc_section("历史归档", input_text)
        except Exception as e:
            print(f"同步到文档失败: {e}", file=sys.stderr)
    
    def suggest_next_mode(self):
        """根据当前状态智能推荐下一个模式"""
        if self.mode == "standby":
            return "planning"
        
        if self.mode == "planning" and self.current_task:
            return "working"
            
        if self.mode == "working" and self.task_complete:
            return "planning"
            
        return self.mode  # 默认保持当前模式

def save_state(state):
    try:
        with open(".review_flow_state.json", "w") as f:
            f.write(state.to_json())
    except Exception as e:
        print(f"保存状态错误: {e}", file=sys.stderr)

def load_state():
    try:
        if os.path.exists(".review_flow_state.json"):
            with open(".review_flow_state.json", "r") as f:
                return WorkflowState.from_json(f.read())
    except Exception as e:
        print(f"加载状态错误: {e}", file=sys.stderr)
    return WorkflowState()

def create_backup(file_path):
    """创建文件备份"""
    if not os.path.exists(file_path):
        return False
        
    backup_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backup")
    os.makedirs(backup_dir, exist_ok=True)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = os.path.basename(file_path)
    backup_path = os.path.join(backup_dir, f"{filename}_{timestamp}.bak")
    
    try:
        shutil.copy2(file_path, backup_path)
        return backup_path
    except Exception as e:
        print(f"备份失败: {e}", file=sys.stderr)
        return False

def read_markdown_file(file_path):
    """读取Markdown文件内容"""
    if not os.path.exists(file_path):
        return {}
    
    sections = {}
    current_section = None
    content = []
    
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            lines = f.readlines()
            
        for line in lines:
            if line.startswith("## "):
                if current_section:
                    sections[current_section] = content
                current_section = line.strip("# \n")
                content = []
            elif current_section:
                content.append(line)
                
        if current_section:
            sections[current_section] = content
    except Exception as e:
        print(f"读取Markdown文件失败: {e}", file=sys.stderr)
    
    return sections

def write_markdown_file(file_path, sections):
    """写入Markdown文件内容"""
    try:
        create_backup(file_path)  # 先备份
        
        with open(file_path, "w", encoding="utf-8") as f:
            for section, content in sections.items():
                f.write(f"## {section}\n")
                f.writelines(content)
                if not content or not content[-1].endswith("\n"):
                    f.write("\n\n")
                else:
                    f.write("\n")
    except Exception as e:
        print(f"写入Markdown文件失败: {e}", file=sys.stderr)
        return False
    return True

def update_working_doc_section(section_name, new_content):
    """更新working.md中的特定部分"""
    file_path = "working.md"
    sections = read_markdown_file(file_path)
    
    if section_name in sections:
        # 添加新内容到现有部分
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        sections[section_name].append(f"\n- **用户反馈 ({timestamp})**: {new_content}\n")
    else:
        # 创建新部分
        sections[section_name] = [f"\n- **用户反馈**: {new_content}\n"]
    
    return write_markdown_file(file_path, sections)

def update_develop_doc_section(section_name, new_content):
    """更新develop.md中的特定部分"""
    file_path = "develop.md"
    sections = read_markdown_file(file_path)
    
    if section_name in sections:
        # 添加新内容到现有部分
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        sections[section_name].append(f"\n### {timestamp} 用户反馈\n\n- {new_content}\n")
    else:
        # 创建新部分
        sections[section_name] = [f"\n### {datetime.now().strftime('%Y-%m-%d')} 用户反馈\n\n- {new_content}\n"]
    
    return write_markdown_file(file_path, sections)

def extract_task_from_working_doc():
    """从working.md中提取当前任务信息"""
    try:
        sections = read_markdown_file("working.md")
        if "工作计划" in sections:
            content = "".join(sections["工作计划"])
            # 寻找阶段目标
            phase_match = re.search(r"\*\*阶段目标[^\*]*\*\*:\s*([^\n]+)", content)
            if phase_match:
                return phase_match.group(1).strip()
        return ""
    except Exception:
        return ""

def analyze_project_structure(base_dir="."):
    """分析项目结构，返回目录树和文件类型统计"""
    structure = {"directories": [], "files": [], "file_types": {}}
    
    for root, dirs, files in os.walk(base_dir):
        # 排除隐藏目录和文件
        dirs[:] = [d for d in dirs if not d.startswith(".")]
        
        rel_path = os.path.relpath(root, base_dir)
        if rel_path != ".":
            structure["directories"].append(rel_path)
        
        for file in files:
            if file.startswith("."):
                continue
                
            file_path = os.path.join(rel_path, file)
            structure["files"].append(file_path)
            
            # 统计文件类型
            ext = os.path.splitext(file)[1].lower()
            if ext:
                structure["file_types"][ext] = structure["file_types"].get(ext, 0) + 1
    
    return structure

def identify_tech_stack(project_structure):
    """根据项目结构识别技术栈"""
    tech_stack = {
        "languages": [],
        "frameworks": [],
        "build_tools": [],
        "databases": [],
        "other": []
    }
    
    # 文件类型到编程语言的映射
    file_ext_to_lang = {
        ".py": "Python",
        ".js": "JavaScript",
        ".ts": "TypeScript",
        ".jsx": "React/JavaScript",
        ".tsx": "React/TypeScript",
        ".html": "HTML",
        ".css": "CSS",
        ".scss": "SCSS",
        ".sass": "Sass",
        ".less": "Less",
        ".php": "PHP",
        ".rb": "Ruby",
        ".java": "Java",
        ".go": "Go",
        ".rs": "Rust",
        ".c": "C",
        ".cpp": "C++",
        ".cs": "C#",
        ".swift": "Swift",
        ".kt": "Kotlin",
        ".md": "Markdown",
        ".json": "JSON",
        ".yml": "YAML",
        ".yaml": "YAML",
        ".xml": "XML",
        ".sql": "SQL"
    }
    
    # 根据文件类型识别编程语言
    for ext, count in project_structure["file_types"].items():
        if ext in file_ext_to_lang and file_ext_to_lang[ext] not in tech_stack["languages"]:
            tech_stack["languages"].append(file_ext_to_lang[ext])
    
    # 检查特定配置文件识别框架和工具
    config_files = [os.path.basename(f) for f in project_structure["files"]]
    
    # 前端框架
    if any(f for f in config_files if "react" in f.lower()):
        tech_stack["frameworks"].append("React")
    if any(f for f in config_files if "vue" in f.lower()):
        tech_stack["frameworks"].append("Vue")
    if any(f for f in config_files if "angular" in f.lower()):
        tech_stack["frameworks"].append("Angular")
    if any(f for f in config_files if "svelte" in f.lower()):
        tech_stack["frameworks"].append("Svelte")
    
    # 后端框架
    if "Python" in tech_stack["languages"]:
        if any(f for f in config_files if f in ["requirements.txt", "Pipfile", "pyproject.toml"]):
            # 检查特定框架
            for file_path in project_structure["files"]:
                if file_path.endswith(".py"):
                    try:
                        with open(file_path, "r", encoding="utf-8") as f:
                            content = f.read()
                            if "flask" in content.lower():
                                tech_stack["frameworks"].append("Flask")
                            if "django" in content.lower():
                                tech_stack["frameworks"].append("Django")
                            if "fastapi" in content.lower():
                                tech_stack["frameworks"].append("FastAPI")
                    except Exception:
                        pass
    
    # 构建工具
    if "package.json" in config_files:
        tech_stack["build_tools"].append("npm/yarn")
        # 检查是否使用webpack、vite等
        for file_path in project_structure["files"]:
            if os.path.basename(file_path) == "package.json":
                try:
                    with open(file_path, "r", encoding="utf-8") as f:
                        package_data = json.load(f)
                        deps = {**package_data.get("dependencies", {}), **package_data.get("devDependencies", {})}
                        if "webpack" in deps:
                            tech_stack["build_tools"].append("Webpack")
                        if "vite" in deps:
                            tech_stack["build_tools"].append("Vite")
                        if "next" in deps:
                            tech_stack["frameworks"].append("Next.js")
                        if "nuxt" in deps:
                            tech_stack["frameworks"].append("Nuxt.js")
                except Exception:
                    pass
    
    # 去重
    for category in tech_stack:
        tech_stack[category] = list(set(tech_stack[category]))
    
    return tech_stack

def cache_project_configs(base_dir="."):
    """缓存项目中的配置文件"""
    config_cache = {}
    config_patterns = [
        "*.json", "*.yml", "*.yaml", "*.toml", "*.ini", 
        "*.config.*", "requirements.txt", "Pipfile", 
        "Dockerfile", ".env*", ".gitignore"
    ]
    
    for pattern in config_patterns:
        for file_path in glob.glob(os.path.join(base_dir, "**", pattern), recursive=True):
            rel_path = os.path.relpath(file_path, base_dir)
            # 只读取小文件，避免内存问题
            if os.path.getsize(file_path) < 1024 * 100:  # 100KB 以下
                try:
                    with open(file_path, "r", encoding="utf-8") as f:
                        config_cache[rel_path] = f.read()
                except Exception:
                    pass
    
    return config_cache

def parse_user_input(input_text, state):
    """解析用户输入，执行特殊命令或准备正常处理"""
    input_lower = input_text.lower()
    
    # 处理内置命令
    if input_lower == "help" or input_lower == "?":
        show_help()
        return None
        
    if input_lower == "status":
        show_status(state)
        return None
        
    if input_lower == "history":
        show_history(state)
        return None
        
    if input_lower.startswith("sync:"):
        toggle = input_lower.split(":", 1)[1].strip()
        if toggle in ["on", "true", "yes", "1"]:
            state.auto_sync = True
            print("自动同步文档已启用", flush=True)
        elif toggle in ["off", "false", "no", "0"]:
            state.auto_sync = False
            print("自动同步文档已禁用", flush=True)
        save_state(state)
        return None
    
    # 普通输入，返回处理
    return input_text

def show_help():
    """显示帮助信息"""
    help_text = """
=== 智能助手增强系统命令 ===
基本命令:
  MODE:planning     - 切换到规划模式
  MODE:working      - 切换到工作模式
  MODE:standby      - 切换到待命模式
  TASK_COMPLETE     - 结束当前任务

特殊命令:
  help / ?          - 显示此帮助信息
  status            - 显示当前状态信息
  history           - 显示历史记录
  sync:on/off       - 启用/禁用文档自动同步

工作流提示:
  规划模式下的输入会自动同步到【用户需求】
  工作模式下的输入会根据内容同步到【工作任务】或【工作计划】
  包含"重要"等关键词的输入会同时同步到develop.md
    """
    print(help_text, flush=True)

def show_status(state):
    """显示当前状态信息"""
    status_text = f"""
=== 当前系统状态 ===
当前模式: {state.mode.upper()}
当前任务: {state.current_task or "无"}
步骤: {state.step}
自动同步: {'启用' if state.auto_sync else '禁用'}
任务完成: {'是' if state.task_complete else '否'}
待处理反馈: {'是' if state.pending_feedback else '否'}

技术栈: {', '.join(state.tech_stack.get('languages', []) + state.tech_stack.get('frameworks', []))}

推荐操作: {'MODE:' + state.suggest_next_mode() if state.suggest_next_mode() != state.mode else '继续当前模式'}
    """
    print(status_text, flush=True)

def show_history(state):
    """显示历史记录"""
    if not state.history:
        print("=== 历史记录为空 ===", flush=True)
        return
        
    print("\n=== 历史记录 (最近5条) ===", flush=True)
    for entry in state.history[-5:]:
        print(f"{entry['time']} [{entry.get('mode', 'unknown').upper()}]: {entry['input']}", flush=True)
    print("", flush=True)

if __name__ == "__main__":
    # 设置无缓冲输出，提高交互响应性
    try:
        sys.stdout = os.fdopen(sys.stdout.fileno(), 'w', buffering=1)
        sys.stderr = os.fdopen(sys.stderr.fileno(), 'w', buffering=1)
    except Exception:
        pass

    # 加载状态
    state = load_state()
    
    # 初始化 - 自动分析项目结构与任务
    if not state.project_structure:
        print("--- 智能助手增强系统: 正在分析项目结构和技术栈... ---", flush=True)
        state.project_structure = analyze_project_structure()
        state.tech_stack = identify_tech_stack(state.project_structure)
        state.config_cache = cache_project_configs()
        
        # 尝试从working.md提取当前任务
        current_task = extract_task_from_working_doc()
        if current_task:
            state.current_task = current_task
            
        save_state(state)
        print("--- 智能助手增强系统: 项目分析完成 ---", flush=True)

    # 欢迎界面与状态提示
    print("\n" + "="*50, flush=True)
    print("=== 智能助手增强系统交互终端 ===", flush=True)
    print("="*50, flush=True)
    print(f"当前模式: {state.mode.upper()}", flush=True)
    print(f"当前任务: {state.current_task or '无'}", flush=True)
    if state.mode != state.suggest_next_mode():
        print(f"推荐操作: MODE:{state.suggest_next_mode()}", flush=True)
    print("\n输入 'help' 或 '?' 获取命令帮助", flush=True)
    print("输入 'TASK_COMPLETE' 结束当前任务", flush=True)
    
    active_session = True
    while active_session:
        try:
            # 显示交互提示符
            mode_indicator = f"[{state.mode.upper()}]"
            print(f"\n{mode_indicator} 等待输入:", end="", flush=True) 
            
            line = sys.stdin.readline()
            
            if not line:  # EOF
                print("--- 智能助手增强系统: 输入流关闭 (EOF)，退出脚本 ---", flush=True)
                active_session = False
                break
            
            user_input = line.strip()
            if not user_input:  # 空行，继续
                continue

            # 处理任务完成命令
            if user_input.upper() == 'TASK_COMPLETE':
                print("--- 智能助手增强系统: 用户确认任务完成 ---", flush=True)
                state.task_complete = True
                state.add_history("TASK_COMPLETE")
                save_state(state)
                active_session = False
                break
                
            # 处理模式切换命令
            elif user_input.upper().startswith('MODE:'):
                mode = user_input.split(':', 1)[1].strip().lower()
                if mode in ["planning", "working", "standby"]:
                    old_mode = state.mode
                    state.mode = mode
                    print(f"--- 智能助手增强系统: 模式已从 {old_mode.upper()} 切换到 {mode.upper()} ---", flush=True)
                    
                    # 模式切换时的特殊处理
                    if mode == "planning":
                        print("进入规划模式 - 请描述您的需求或下一阶段目标", flush=True)
                    elif mode == "working":
                        if not state.current_task:
                            state.current_task = extract_task_from_working_doc()
                            if state.current_task:
                                print(f"当前任务: {state.current_task}", flush=True)
                        print("进入工作模式 - 将按照工作计划执行任务", flush=True)
                    
                    state.add_history(f"Changed mode to {mode}")
                    save_state(state)
                else:
                    print(f"--- 智能助手增强系统: 无效模式 {mode} ---", flush=True)
                    print("有效模式: planning, working, standby", flush=True)
                    
            # 处理特殊命令
            else:
                processed_input = parse_user_input(user_input, state)
                if processed_input:
                    # 这是AI将"监听"的关键行
                    print(f"用户输入: {processed_input}", flush=True)
                    state.add_history(processed_input)
                save_state(state)
                    
                # 提示可能的下一步操作
                next_mode = state.suggest_next_mode()
                if next_mode != state.mode:
                    print(f"提示: 考虑使用 'MODE:{next_mode}' 切换到{next_mode}模式", flush=True)
            
        except KeyboardInterrupt:
            print("\n--- 智能助手增强系统: 会话被用户中断 (KeyboardInterrupt) ---", flush=True)
            active_session = False
            break
        except Exception as e:
            print(f"\n--- 智能助手增强系统: 脚本错误: {e} ---", flush=True)
            active_session = False
            break
            
    print("\n--- 智能助手增强系统脚本已退出 ---", flush=True)
    print("感谢使用智能助手增强系统！", flush=True)