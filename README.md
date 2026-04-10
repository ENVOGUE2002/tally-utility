# Piece Rate Billing, Reconciliation, and Payment System

This project is a starter blueprint for a garment factory piece-rate workflow.

## Goal

Build software that helps manage:

- Style-wise operation rates
- Style image and color records
- Cutting quantities size-wise
- Daily production/acceptance entry
- Billing calculation
- Reconciliation between cutting, production, and accepted goods
- Worker or line-wise payment calculation

## Business Flow

1. Buyer order is received.
2. Style is finalized with a style number, image, and color.
3. CMT rate is decided for the style.
4. Operation-wise rates are defined.
   Example:
   - Singer
   - Overlock
   - Kaaj
   - Button
   - Collar
   - Patti
5. Style is handed over to piece-rate supervision.
6. Cutting details are entered size-wise after fabric is cut.
7. Stitching production is entered day by day or after style completion.
8. Accepted goods are entered size-wise after checking/counting.
9. System calculates:
   - Total goods made
   - Total accepted goods
   - Operation-wise billing
   - Style-wise cost
   - Payment due
10. At day end or style completion, reports are reviewed.

## Suggested MVP Modules

### 1. Style Master

Store:

- Style number
- Buyer
- Style name/description
- Color
- Image
- Total CMT rate
- Status

### 2. Operation Rate Master

Store the rate per operation for each style.

Example:

- Singer: Rs 12
- Overlock: Rs 5
- Kaaj: Rs 3
- Button: Rs 4
- Collar: Rs 4
- Patti: Rs 2

Total can match the style CMT rate.

### 3. Cutting Entry

Enter cutting quantity size-wise:

- XS
- S
- M
- L
- XL
- XXL

This becomes the planned quantity for reconciliation.

### 4. Daily Production Entry

Enter stitched/produced quantity day-wise:

- Date
- Style
- Operation
- Worker or contractor
- Size
- Quantity produced

### 5. Acceptance / Checking Entry

Enter accepted quantity size-wise:

- Date
- Style
- Size
- Quantity accepted
- Rejected quantity

### 6. Billing Calculation

System should calculate:

- Quantity x operation rate
- Quantity x full CMT rate
- Worker-wise payable
- Style-wise production cost

### 7. Reconciliation

Compare:

- Cut quantity
- Produced quantity
- Accepted quantity
- Balance quantity
- Rejection quantity

### 8. Reports

Reports needed:

- Daily production report
- Style-wise summary
- Size-wise cutting vs accepted
- Worker-wise billing
- Contractor-wise billing
- Pending balance report
- Final payment register

## Recommended Core Formulas

### Style Billing

`Style Billing = Accepted Quantity x Total CMT Rate`

### Operation Billing

`Operation Billing = Operation Quantity x Operation Rate`

### Balance Quantity

`Balance = Cut Quantity - Accepted Quantity`

### Rejection Quantity

`Rejection = Produced Quantity - Accepted Quantity`

## Important Rules

- Accepted quantity should not normally exceed produced quantity.
- Produced quantity should be tracked date-wise.
- Cutting and acceptance should be size-wise.
- Operation rates must belong to a style.
- Final payment should be based on approved business logic:
  - produced quantity, or
  - accepted quantity, or
  - mixed rule depending on operation

## Suggested Screens

1. Dashboard
2. Style master
3. Operation rate entry
4. Cutting entry
5. Daily production entry
6. Acceptance entry
7. Billing summary
8. Reconciliation report
9. Worker payment report

## Recommended Tech Stack for a Simple First Version

For a practical first version:

- Frontend: React
- Backend: Node.js + Express
- Database: SQLite for local use, PostgreSQL later if needed

If you want the fastest start, we can also begin with:

- Excel-like web UI
- Local database
- Print-ready reports

## What We Should Build First

Best MVP order:

1. Style master
2. Operation rate master
3. Cutting entry
4. Acceptance entry
5. Billing summary
6. Reconciliation report

Daily production and worker-wise advanced payment rules can be added next.

## Example

Style: `ST-101`

Total CMT: `Rs 30`

Operation rates:

- Singer: Rs 12
- Overlock: Rs 5
- Kaaj: Rs 3
- Button: Rs 4
- Collar: Rs 4
- Patti: Rs 2

Accepted quantity:

- S: 100
- M: 120
- L: 80

Total accepted = `300`

Style billing = `300 x 30 = Rs 9,000`

## Next Build Direction

The best next step is to create a small working app with:

- Style creation
- Operation rates
- Size-wise cutting entry
- Size-wise acceptance entry
- Auto billing summary

That will give you a usable first version very quickly.

## Current MVP In This Folder

A working local browser app is included:

- [index.html](D:\New folder\Piece rate Calculator\index.html)
- [styles.css](D:\New folder\Piece rate Calculator\styles.css)
- [app.js](D:\New folder\Piece rate Calculator\app.js)

### How to Use

1. Open [index.html](D:\New folder\Piece rate Calculator\index.html) in your browser.
2. Create a style and enter operation rates.
3. Add cutting quantity size-wise.
4. Add production entries worker-wise and operation-wise.
5. Add acceptance and rejection size-wise.
6. Check dashboard and reports for billing and reconciliation.

### Excel Upload

You can fill the sample files in Microsoft Excel and save them as CSV, then upload them into the app.

Sample templates:

- [style-sample.csv](D:\New folder\Piece rate Calculator\style-sample.csv)
- [cutting-sample.csv](D:\New folder\Piece rate Calculator\cutting-sample.csv)
- [production-sample.csv](D:\New folder\Piece rate Calculator\production-sample.csv)

Current bulk upload support:

- Style master upload
- Cutting details upload
- Production details upload

Current note:

- This version supports CSV files created from Excel
- Direct `.xlsx` upload can be added later in the next software version

### Production Logic

The app now supports two production methods:

- Style-wise production entry for style billing
- Operation-wise production entry for worker payment

Recommended use:

- Use style-wise production to record total garment quantity size-wise
- Use operation-wise production to calculate worker or contractor payment

### Style-wise Amount Report

You can check style-wise billing amount in two places:

- Dashboard `Style Billing Summary`
- Reports `Style-wise Amount Report`

You can also:

- Select a report date
- View the filtered report
- Download the filtered style-wise amount report as CSV

### Custom Sizes

You can define your own size list from the sidebar.

Examples:

- `28,30,32,34,36`
- `S,M,L,XL,2XL,3XL,4XL`
- `28,30,32,34,36,3XL,4XL`

### What This MVP Does

- Saves data in browser local storage
- Calculates style billing from accepted quantity x CMT rate
- Calculates worker billing from production quantity x operation rate
- Shows cut, produced, accepted, rejected, and balance quantities
- Supports export and import of data in JSON format
- Shows company name `ENVOGUE CLOTHING`
- Allows style edit at any time
- Allows style delete only when no cutting, production, or acceptance data exists for that style
- Allows style image upload from your computer
- Allows bulk upload for style, cutting, and production using CSV files prepared in Excel

### Limitation

This first version works fully in the browser and does not yet use a shared database, login system, or multi-user access.

If you host it online as a static website:

- the app will open from anywhere with the website link
- data will still stay in each user's browser local storage
- data will not automatically sync between phones, laptops, or users
- for shared live data, this app needs a backend database and login system

## Host Online

This project is ready for static hosting because it uses only:

- `index.html`
- `styles.css`
- `app.js`

Easy hosting options:

- Vercel
- Netlify
- GitHub Pages

### Fastest Option: Vercel

1. Put this folder in a GitHub repository.
2. Sign in to [Vercel](https://vercel.com/).
3. Click `Add New Project`.
4. Import the GitHub repository.
5. Keep the default settings.
6. Deploy.

This folder already includes [vercel.json](D:\New folder\Piece rate Calculator - Copy\vercel.json), so Vercel can publish it as a static site.

### Fastest Option: Netlify

1. Put this folder in a GitHub repository.
2. Sign in to [Netlify](https://www.netlify.com/).
3. Choose `Add new site` and import the repository.
4. Publish the site.

This folder already includes [netlify.toml](D:\New folder\Piece rate Calculator - Copy\netlify.toml), which tells Netlify to publish the project root.

### GitHub Pages

1. Create a GitHub repository and upload this project.
2. Open repository `Settings`.
3. Open `Pages`.
4. Set source to the main branch root.
5. Save.

GitHub Pages can host this project because it is a plain static website.

### Important Before You Share The Link

Hosting this version online is good for:

- opening the app from anywhere
- using it on mobile or desktop
- sharing the website link

Hosting this version online is not enough for:

- shared office data
- multi-user login
- one common database for everyone

For that next step, the app should be upgraded to a real web app with backend storage such as:

- frontend: current UI or React
- backend: Node.js / Express
- database: PostgreSQL, Supabase, or Firebase

## Shared Cloud Data With Supabase

This folder now includes a simple shared-data mode using Supabase.

Files:

- [config.js](D:\New folder\Piece rate Calculator - Copy\config.js)
- [config.example.js](D:\New folder\Piece rate Calculator - Copy\config.example.js)
- [supabase-schema.sql](D:\New folder\Piece rate Calculator - Copy\supabase-schema.sql)

### What It Does

- keeps the current browser app and screens
- stores one shared application state in Supabase
- lets multiple PCs load the same data
- syncs new changes to the cloud after save
- checks for newer cloud changes automatically

### Setup Steps

1. Create a project in [Supabase](https://supabase.com/).
2. Open the SQL editor.
3. Run the SQL from [supabase-schema.sql](D:\New folder\Piece rate Calculator - Copy\supabase-schema.sql).
4. Open [config.js](D:\New folder\Piece rate Calculator - Copy\config.js).
5. Paste your Supabase `Project URL`.
6. Paste your Supabase `anon key`.
7. Deploy the site again.

### Important Note

This shared mode stores the full app data as one JSON record.

That is good for:

- simple shared office usage
- same data on multiple PCs
- quick setup without building a full backend

Later, if you want stronger multi-user controls, user logins, record history, or more advanced reporting, the next upgrade would be a proper table-based backend design.

## Can This Become Independent Software Later?

Yes. This MVP can later be converted into a full independent software product.

Recommended upgrade path:

1. Keep the same workflow and screens
2. Move data from browser storage to a real database
3. Add employee master and bank details
4. Add user login and role-based access
5. Generate payment transfer files and reports
6. Package it as a desktop app or web-based office software

Good future options:

- Desktop software with Electron
- Office web app with Node.js and PostgreSQL
- Multi-user cloud software later if needed

## Use As Standalone On This Computer

Right now, the simplest standalone use is:

1. Keep the whole folder together
2. Double-click [Launch Piece Rate Calculator.cmd](D:\New folder\Piece rate Calculator\Launch Piece Rate Calculator.cmd)
3. The app will open on this computer in your default browser

Important:

- Your data is saved in that browser on that computer
- Do not move only one file; keep the full folder together

## About `.exe`

A real installable `.exe` can be made later, but it needs a desktop packaging stack such as:

- Electron
- Tauri

This current environment does not have the build tools installed for generating a proper `.exe` installer right now.
