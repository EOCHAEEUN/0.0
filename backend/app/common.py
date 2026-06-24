from pathlib import Path

def save_graph_visualization(app, base_name:str) -> None:
    #-> None는 반환 타입 힌트(Type Hint)다.
    # return 값 없이 파일 저장, 출력 같은 동작만 수행하는 함수라는 걸 명시
    mermaid = app.get_graph().draw_mermaid()
    print("\n[Mermaid 그래프]")
    print(mermaid)

    mermaid_path = Path(f"./images/{base_name}.mmd")
    mermaid_path.write_text(mermaid, encoding="utf-8")
    print(f"Mermaid 텍스트 저장 완료 : {mermaid_path.name}")

    try :
        png_data = app.get_graph().draw_mermaid_png()
        png_path = Path(f"./images/{base_name}.png")
        png_path.write_bytes(png_data)
        print(f"그래프 이미지 저장 완료 : {png_path.name}")
    except Exception as error :
        print(f"PNG 생성은 실패했지만 Mermaid 텍스트는 저장했습니다 : {error}")


