from typing import List
from bson import ObjectId
from datetime import datetime, timezone
import os
import pydash
import functools

from ..db.collection import AnnoJob, JobStatus
from ...config import Conf, settings
from .user import user_service
from ...dto.data_seq import SimpleDataSeq
from .team import team_service
from ...dto.users import RoleEnum, UserJobAuth
from .role import role_service
from ...log import logger
from yinghuo_app.dto.seq_data import SeqData


class JobService(object):
    def __init__(self):
        pass
    
    async def create_job(self, user_id:int, dto: AnnoJob):
        # 重置核心字段
        dto._id = ObjectId()
        dto.creater = user_id
        dto.created_time = datetime.now(timezone.utc)
        dto.updated_time = datetime.now(timezone.utc)
        dto.authority = None
        
        # 设定初始状态
        dto.current_status = JobStatus(status=JobStatus.Status.NEW_JOB, update_time=datetime.now(timezone.utc), user_id=user_id)
        dto.status_history = [dto.current_status]

        job_def = dto.model_dump()
        job_def["authority"] = {
            "owners": [user_id],
        }
        
        seq = job_def["label_spec"]["data"]["seq"]
        if job_def["label_spec"]["data"]["format"] == "simple-directory":
            # 处理 dataSource: "imageURLs"类别的数据
            if job_def["label_spec"]["data"]["dataSource"] == "imageURLs":
                # sds = SimpleDataSeq(None, seq)
                meta_dict, stream_meta_dicts, streams = SimpleDataSeq.build_meta_from(job_def)
            elif job_def["label_spec"]["data"]["dataSource"] == "localImage":
                # sds = SimpleDataSeq(None, seq)
                # meta_dict, stream_meta_dicts, streams = sds.build_meta_from(job_def)
                meta_dict, stream_meta_dicts, streams = SimpleDataSeq.build_meta_from(job_def)
            else:
                file_exts = job_def["label_spec"]["data"]["file_exts"]
                if file_exts is None or len(file_exts) == 0:
                    raise Exception("file_exts不能为空")
            
                data_root = os.path.join(settings.YH_USER_DATA_ROOT, str(user_id))
                sds = SimpleDataSeq(data_root, seq, streams=dto.label_spec.data.streams, file_exts=file_exts)
                meta_dict, stream_meta_dicts, streams = sds.build_seq_meta()
                # return wrap_json(sds.get_seq_meta())
            job_def["label_spec"]["data"]["streams"] = streams
        elif job_def["label_spec"]["data"]["format"] == "openlabel":
            data_root = os.path.join(settings.YH_USER_DATA_ROOT, str(user_id))
            seq_dir = os.path.join(data_root, seq.lstrip("/"))
            meta_path = os.path.join(seq_dir, "meta.json")
            if not os.path.exists(meta_path):
                raise Exception(f"数据路径无效：{seq} 下未找到 meta.json（OpenLABEL格式），请选择包含 meta.json 的数据目录，或将数据格式改为 directory")
            seqData = SeqData.from_seq_data_dir(seq_dir)
            meta_dict = seqData.seq_meta_obj.meta_dict
            # stream_meta_dicts = {k:v.meta_dict for k, v in seqData.stream_metas_obj.streams.items()}
            streams = job_def["label_spec"]["data"]["streams"]
            stream_meta_dicts = [seqData.stream_metas_obj.streams[stream].meta_dict for stream in streams]
        else:
            raise Exception("未知的format类型")
        
        if len(streams) < 1:
            raise Exception("streams不存在")
        result = Conf.MG_ANNO_JOB_PERFORM.insert_one(job_def)
        if result.acknowledged:
            r1 = Conf.MG_DATA_SEQ_META.insert_one(
                {
                    "authority": {
                        "owners": [user_id],
                    },
                    "job": {"seq": seq, "uuid": result.inserted_id},
                    "datas": meta_dict,
                }
            )
            if not r1.acknowledged:
                raise Exception("插入seq_meta数据失败")
            
            for stream, stream_meta_dict in zip(streams, stream_meta_dicts):
                Conf.MG_DATA_STREAM_META.insert_one(
                    {
                        "authority": {
                            "owners": [user_id],
                        },
                        "job": {
                            "seq": seq,
                            "stream": stream,
                            "uuid": result.inserted_id,
                        },
                        "datas": stream_meta_dict,
                    }
                )
        else:
            raise Exception("插入job数据失败")

    @functools.lru_cache(maxsize=1024)
    def can_user_see_job(self, user_id: int, job_id: str, freshness=0):
        """user_id是否能标注job_id的数据

        Args:
            user_id (int): _description_
            job_id (str): _description_

        Returns:
            _type_: _description_
        """
        
        query1 = {"authority.owners": user_id}
        query2 = {"authority.collaborators": user_id}
        my_depts = team_service.find_my_dept_ids(user_id)
        query3 = {"authority.dept": {"$in": my_depts}}
        role_query = {"$or": [query1, query2, query3]}
        id_query = {"_id": ObjectId(job_id)}
        
        all_query = {"$and": [id_query, role_query]} # 数据存在，并且我有权限
        doc = Conf.MG_ANNO_JOB_PERFORM.find_one(all_query)
        return doc
    
    
    def get_job(self, job_id: str):
        """
        """
        id_query = {"_id": ObjectId(job_id)}
        doc = Conf.MG_ANNO_JOB_PERFORM.find_one(id_query)
        return doc
    
    def get_user_job_auth(self, user_id: int, job_id: str)->UserJobAuth:
        """获取用户对某个job的权限

        Args:
            user_id (int): _description_
            job_id (str): _description_

        Returns:
            _type_: _description_
        """
        assert job_id is not None
        query1 = {"authority.owners": user_id}
        query2 = {"authority.collaborators": user_id}
        
        _rows = team_service.find_my_team(user_id)
        rows = list(_rows)
        
        my_depts = []
        my_dept_roles = {}
        for row in rows:
            my_depts.append(row["dept"])
            if row["dept"] is not None and row["roles"] is not None:
                my_dept_roles[row["dept"]] = row["roles"]
        
        # my_depts = team_service.find_my_dept_ids(user_id)
        query3 = {"authority.dept": {"$in": my_depts}}
        role_query = {"$or": [query1, query2, query3]}
        id_query = {"_id": ObjectId(job_id)}
        
        all_query = {"$and": [id_query, role_query]} # 数据存在，并且我有权限
        doc = Conf.MG_ANNO_JOB_PERFORM.find_one(all_query)
        if doc is None:
            return UserJobAuth.FORBIDDEN
        if user_id in pydash.get(doc, "authority.owners", []):
            return UserJobAuth.OWNER
        if user_id in pydash.get(doc, "authority.collaborators", []):
            return UserJobAuth.COLLABORATOR
        
        # dept 权限
        dept_id = doc["authority"]["dept"]
        my_roles = my_dept_roles.get(dept_id, [])
        role_names = role_service.get_role_name(my_roles)
        logger.info(f"role ids names : {my_roles} : {role_names}")
        if RoleEnum.ADMIN.value in role_names or RoleEnum.MANAGER.value in role_names:
            return UserJobAuth.DEPT_ROLE_MANAGE
        else:
            return UserJobAuth.DEPT_ROLE_ANNO

job_service = JobService()
