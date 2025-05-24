# review_flow.py
import sys
import os
import json
import time
import re
import glob
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

    def to_json(self):
        return json.dumps({
            "mode": self.mode,
            "step": self.step,
            "task_complete": self.task_complete,
            "history": self.history,
            "project_structure": self.project_structure,
            "tech_stack": self.tech_stack,
            "config_cache": self.config_cache
        })

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
        except Exception as e:
            print(f"Error parsing state: {e}", file=sys.stderr)
        return state

    def add_history(self, input_text):
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self.history.append({"time": timestamp, "input": input_text})

def save_state(state):
    try:
        with open(".review_flow_state.json", "w") as f:
            f.write(state.to_json())
    except Exception as e:
        print(f"Error saving state: {e}", file=sys.stderr)

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
    
    # 数据库
    db_indicators = {
        "mongodb": "MongoDB",
        "mongoose": "MongoDB",
        "sequelize": "SQL (Sequelize ORM)",
        "typeorm": "SQL (TypeORM)",
        "prisma": "SQL (Prisma ORM)",
        "sqlite": "SQLite",
        "mysql": "MySQL",
        "postgresql": "PostgreSQL",
        "postgres": "PostgreSQL",
        "redis": "Redis"
    }
    
    for file_path in project_structure["files"]:
        try:
            if file_path.endswith((".js", ".py", ".ts", ".json")):
                with open(file_path, "r", encoding="utf-8") as f:
                    content = f.read().lower()
                    for indicator, db_name in db_indicators.items():
                        if indicator in content and db_name not in tech_stack["databases"]:
                            tech_stack["databases"].append(db_name)
        except Exception:
            pass
    
    # 去重
    for category in tech_stack:
        tech_stack[category] = list(set(tech_stack[category]))
    
    return tech_stack

def get_config_file_content(file_path):
    """读取配置文件内容并返回"""
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
        return content
    except Exception as e:
        return f"Error reading file: {e}"

def cache_project_configs(base_dir="."):
    """缓存项目中的配置文件"""
    config_cache = {}
    config_patterns = [
        "*.json",
        "*.yml", "*.yaml",
        "*.toml",
        "*.ini",
        "*.config.*",
        "requirements.txt",
        "Pipfile",
        "Dockerfile",
        ".env*",
        ".gitignore"
    ]
    
    for pattern in config_patterns:
        for file_path in glob.glob(os.path.join(base_dir, "**", pattern), recursive=True):
            rel_path = os.path.relpath(file_path, base_dir)
            config_cache[rel_path] = get_config_file_content(file_path)
    
    return config_cache

def load_state():
    try:
        if os.path.exists(".review_flow_state.json"):
            with open(".review_flow_state.json", "r") as f:
                return WorkflowState.from_json(f.read())
    except Exception as e:
        print(f"Error loading state: {e}", file=sys.stderr)
    return WorkflowState()

if __name__ == "__main__":
    # Try to make stdout unbuffered for more responsive interaction
    try:
        sys.stdout = os.fdopen(sys.stdout.fileno(), 'w', buffering=1)
    except Exception:
        pass  # Ignore if unbuffering fails

    try:
        sys.stderr = os.fdopen(sys.stderr.fileno(), 'w', buffering=1)
    except Exception:
        pass  # Ignore

    # Load previous state if exists
    state = load_state()
    
    # 如果进入规划模式且项目结构为空，则自动分析项目
    if state.mode == "planning" and not state.project_structure:
        print("--- REVIEW FLOW: 正在分析项目结构和技术栈... ---", flush=True)
        state.project_structure = analyze_project_structure()
        state.tech_stack = identify_tech_stack(state.project_structure)
        state.config_cache = cache_project_configs()
        save_state(state)
        print("--- REVIEW FLOW: 项目分析完成 ---", flush=True)

    print("--- REVIEW FLOW ACTIVE ---", flush=True)
    print(f"Current mode: {state.mode.upper()}", flush=True)
    print("AI has completed its primary actions. Awaiting your review or further sub-prompts.", flush=True)
    print("Type your sub-prompt, 'MODE:planning' to enter planning mode, 'MODE:working' to enter working mode, or 'TASK_COMPLETE' to conclude.", flush=True)
    
    active_session = True
    while active_session:
        try:
            # Signal that the script is ready for input
            print("REVIEW_FLOW_AWAITING_INPUT:", end="", flush=True) 
            
            line = sys.stdin.readline()
            
            if not line:  # EOF
                print("--- REVIEW FLOW: STDIN CLOSED (EOF), EXITING SCRIPT ---", flush=True)
                active_session = False
                break
            
            user_input = line.strip()

            if user_input.upper() == 'TASK_COMPLETE':
                print("--- REVIEW FLOW: USER CONFIRMED TASK COMPLETE ---", flush=True)
                state.task_complete = True
                save_state(state)
                active_session = False
                break
            elif user_input.upper().startswith('MODE:'):
                mode = user_input.split(':', 1)[1].strip().lower()
                if mode in ["planning", "working", "standby"]:
                    state.mode = mode
                    print(f"--- REVIEW FLOW: MODE CHANGED TO {mode.upper()} ---", flush=True)
                    state.add_history(f"Changed mode to {mode}")
                    save_state(state)
                else:
                    print(f"--- REVIEW FLOW: INVALID MODE {mode} ---", flush=True)
            elif user_input: # If there's any input other than an empty line
                # This is the critical line the AI will "listen" for
                print(f"USER_REVIEW_SUB_PROMPT: {user_input}", flush=True)
                state.add_history(user_input)
                save_state(state)
            # If the input is just an empty line, the loop continues, waiting for actual input
            
        except KeyboardInterrupt:
            print("--- REVIEW FLOW: SESSION INTERRUPTED BY USER (KeyboardInterrupt) ---", flush=True)
            active_session = False
            break
        except Exception as e:
            print(f"--- REVIEW FLOW: SCRIPT ERROR: {e} ---", flush=True)
            active_session = False
            break
            
    print("--- REVIEW FLOW SCRIPT EXITED ---", flush=True)