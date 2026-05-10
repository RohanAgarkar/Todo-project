import os
class Config:
    if os.path.exists("./data/kanban.db"):
        create_tables: bool = False
        seed_tables: bool = False
    else:
        create_tables: bool = True
        seed_tables: bool = True