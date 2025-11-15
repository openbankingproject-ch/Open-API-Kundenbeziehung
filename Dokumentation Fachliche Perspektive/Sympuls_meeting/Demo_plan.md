Draft for display and data flow of the demos for Synpulse meeting

# First page

   
```
Select demo scenario:
┌─────────────────────────┐   ┌─────────────────────────┐
│   Demo bank transfer    │   │   Demo life insurance   │
└─────────────────────────┘   └─────────────────────────┘

```

# Demo pages

Both demos will have almost identical page setups with slightly different wording and data being sent

## User registration page bank A

**Page for registering a new user at bank A with all the data**
```

 Enter Data customer data 
 ──────────────────────── 

 First Name:              
 ┌─────────────────────┐  
 └─────────────────────┘  
 
 Last Name:               
 ┌─────────────────────┐  
 └─────────────────────┘  

 Birthday:                
 ┌─────────────────────┐  
 └─────────────────────┘  
 
 .                    
 .        (not quite sure what fields are all needed)            
 .           

┌───────────┐
│ Next step │
└───────────┘
```
## Display sent request and response page

**Display the what is sent under the hood**


```
POST request
────────────
POST /api/2.2/sites/9a8b7c6d-5e4f-3a2b-1c0d-9e8f7a6b5c4d/users HTTP/1.1
HOST: my-server
X-Tableau-Auth: 12ab34cd56ef78ab90cd12ef34ab56cd
Content-Type: application/json

{
  "user": {
    "name": "NewUser1",
    "siteRole":  "Publisher"
  }
}

Server response
───────────────
HTTP/1.1 200 OK
┌───────────┐
│ Next step │
└───────────┘
```
## User data transfer bank B page

**Page for requesting data about user that is transferred to bank B with minimal information required**
```
Enter Data customer data 
 ──────────────────────── 

 First Name:              
 ┌─────────────────────┐  
 └─────────────────────┘  
 
 Last Name:               
 ┌─────────────────────┐  
 └─────────────────────┘  

 Birthday:                
 ┌─────────────────────┐  
 └─────────────────────┘  
 
┌───────────┐
│ Next step │
└───────────┘
```
## Page showing data request and received data
```
Data requested 
──────────────
 
GET /api/2.2/sites/9a8b7c6d-5e4f-3a2b-1c0d-9e8f7a6b5c4d/users/users HTTP/1.1
HOST: my-server
X-Tableau-Auth: 12ab34cd56ef78ab90cd12ef34ab56cd

Data received 
─────────────
{
  "user": {
    "name": "NewUser1",
    "siteRole":  "Publisher"
  }
}

┌───────────┐
│ Next step │
└───────────┘
```
## Page showing successful registration of user

User NewUser1 successfully registered at bank B 
─────────────────────────────────────────────── 

# Data flow
```
       ┌─────────────────┐
       │                 │
       │Demo choice page │
       │                 │
       └─────────────────┘
                │
                │ redirect
                │
                ▼
       ┌─────────────────┐      PUT req
       │                 │─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
       │   Bank A page   │
       │                 │◀ ─ ─ ─ ─ ─ ─ ─ ─ ─       │
       └─────────────────┘        res        │
                │                                   │
display req/res │                            │
                │                                   │
                ▼                            │      ▼
       ┌─────────────────┐            ┌──────────────────┐
       │                 │            │                  │
       │   Bank A page   │            │  Node Instance   │
       │                 │            │                  │
       └─────────────────┘            └──────────────────┘
                │                            ▲
      redirect  │                                   │
                │                            │
                ▼                                   │
       ┌─────────────────┐      GET req      │
       │  Bank B/ life   │─ ─ ─ ─ ─ ─ ─ ─ ─ ─       │
       │ insureance page │
       │                 │◀ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
       └─────────────────┘               res
                │
display req/res │
                │
                ▼
       ┌─────────────────┐
       │  Bank B/ life   │
       │ insureance page │
       │                 │
       └─────────────────┘
                │
     redirect   │
                │
                ▼
       ┌─────────────────┐
       │                 │
       │   Sucess page   │
       │                 │
       └─────────────────┘
```
