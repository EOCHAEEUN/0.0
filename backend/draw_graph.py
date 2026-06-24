from app.graph import build_graph
from app.common import save_graph_visualization
from pathlib import Path
import traceback

Path("./images").mkdir(exist_ok=True)

try:
    factofit_graph = build_graph()
    print("그래프 빌드 성공!")
    print(factofit_graph.get_graph().edges)
    save_graph_visualization(factofit_graph, "factofit_v2")
except Exception as e:
    traceback.print_exc()