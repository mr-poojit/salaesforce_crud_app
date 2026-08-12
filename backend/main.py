import os
import requests
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any, Optional, List
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Salesforce CRUD API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration defaults for Salesforce External Client App OAuth
SALESFORCE_CLIENT_ID = os.getenv("SALESFORCE_CLIENT_ID", "")
SALESFORCE_CLIENT_SECRET = os.getenv("SALESFORCE_CLIENT_SECRET", "")
SALESFORCE_REDIRECT_URI = os.getenv("SALESFORCE_REDIRECT_URI", "http://localhost:5173")
SALESFORCE_LOGIN_URL = os.getenv("SALESFORCE_LOGIN_URL", "https://login.salesforce.com")

OBJECT_FIELDS = {
    "Account": ["Id", "Name", "Type", "Industry", "Phone", "Rating", "AnnualRevenue", "Website"],
    "Opportunity": ["Id", "Name", "StageName", "Amount", "CloseDate", "Type", "LeadSource", "Probability"],
    "Lead": ["Id", "FirstName", "LastName", "Company", "Email", "Status", "Phone", "Title", "LeadSource"],
    "Contact": ["Id", "FirstName", "LastName", "Email", "Phone", "Department", "Title", "LeadSource"],
    "Case": ["Id", "CaseNumber", "Subject", "Status", "Priority", "Origin", "Type", "Reason"]
}

class TokenExchangeRequest(BaseModel):
    code: str
    redirect_uri: str
    client_id: Optional[str] = None
    client_secret: Optional[str] = None
    code_verifier: Optional[str] = None


class CreateRecordRequest(BaseModel):
    instance_url: str
    access_token: str
    object_name: str
    data: Dict[str, Any]

class UpdateRecordRequest(BaseModel):
    instance_url: str
    access_token: str
    object_name: str
    record_id: str
    data: Dict[str, Any]

class DeleteRecordRequest(BaseModel):
    instance_url: str
    access_token: str
    object_name: str
    record_id: str

@app.get("/api/config")
def get_config():
    return {
        "client_id": os.getenv("SALESFORCE_CLIENT_ID", ""),
        "login_url": os.getenv("SALESFORCE_LOGIN_URL", "https://login.salesforce.com"),
        "redirect_uri": os.getenv("SALESFORCE_REDIRECT_URI", "http://localhost:5173"),
        "object_fields": OBJECT_FIELDS
    }


@app.post("/api/oauth/token")
def exchange_code_for_token(req: TokenExchangeRequest):
    client_id = req.client_id or os.getenv("SALESFORCE_CLIENT_ID", "")
    client_secret = req.client_secret or os.getenv("SALESFORCE_CLIENT_SECRET", "")
    
    payload = {
        "grant_type": "authorization_code",
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": req.redirect_uri,
        "code": req.code
    }
    if req.code_verifier:
        payload["code_verifier"] = req.code_verifier
    
    response = requests.post(f"{SALESFORCE_LOGIN_URL}/services/oauth2/token", data=payload)
    if response.status_code != 200:
        err_detail = response.text
        try:
            err_detail = response.json()
        except Exception:
            pass
        print("Salesforce Token Error:", response.status_code, err_detail)
        raise HTTPException(status_code=response.status_code, detail=err_detail)
    
    return response.json()



@app.get("/api/records")
def get_records(
    instance_url: str,
    access_token: str,
    object_name: str,
    offset: int = 0,
    limit: int = 20
):
    if object_name not in OBJECT_FIELDS:
        raise HTTPException(status_code=400, detail="Invalid object name")
    
    fields = ", ".join(OBJECT_FIELDS[object_name])
    soql = f"SELECT {fields} FROM {object_name} ORDER BY CreatedDate DESC LIMIT {limit} OFFSET {offset}"
    
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    
    url = f"{instance_url}/services/data/v58.0/query/?q={requests.utils.quote(soql)}"
    res = requests.get(url, headers=headers)
    
    if res.status_code != 200:
        raise HTTPException(status_code=res.status_code, detail=res.json())
    
    return res.json()

@app.post("/api/records/create")
def create_record(req: CreateRecordRequest):
    if req.object_name not in OBJECT_FIELDS:
        raise HTTPException(status_code=400, detail="Invalid object name")
    
    headers = {
        "Authorization": f"Bearer {req.access_token}",
        "Content-Type": "application/json"
    }
    
    url = f"{req.instance_url}/services/data/v58.0/sobjects/{req.object_name}/"
    res = requests.post(url, json=req.data, headers=headers)
    
    if res.status_code not in (200, 201):
        raise HTTPException(status_code=res.status_code, detail=res.json())
    
    return res.json()

@app.patch("/api/records/update")
def update_record(req: UpdateRecordRequest):
    if req.object_name not in OBJECT_FIELDS:
        raise HTTPException(status_code=400, detail="Invalid object name")
    
    headers = {
        "Authorization": f"Bearer {req.access_token}",
        "Content-Type": "application/json"
    }
    
    url = f"{req.instance_url}/services/data/v58.0/sobjects/{req.object_name}/{req.record_id}"
    res = requests.patch(url, json=req.data, headers=headers)
    
    if res.status_code not in (200, 204):
        raise HTTPException(status_code=res.status_code, detail=res.text if res.text else {"success": True})
    
    return {"success": True, "id": req.record_id}

@app.delete("/api/records/delete")
def delete_record(
    instance_url: str,
    access_token: str,
    object_name: str,
    record_id: str
):
    if object_name not in OBJECT_FIELDS:
        raise HTTPException(status_code=400, detail="Invalid object name")
    
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    
    url = f"{instance_url}/services/data/v58.0/sobjects/{object_name}/{record_id}"
    res = requests.delete(url, headers=headers)
    
    if res.status_code not in (200, 204):
        err_detail = res.text
        try:
            err_detail = res.json()
        except Exception:
            pass
        print("Salesforce Delete Error:", res.status_code, err_detail)
        raise HTTPException(status_code=res.status_code, detail=err_detail)
    
    return {"success": True, "id": record_id}

