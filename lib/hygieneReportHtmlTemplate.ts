export interface SingleAuditReportData {
  platform: string;
  restaurant_name: string;
  city?: string;
  url: string;
  cuisines?: string;
  ratings?: { delivery?: string; dining?: string };
  scorecard: {
    overall_score: number;
    total_dishes: number;
    dishes_with_photos: number;
    dishes_missing_photos: number;
    photo_coverage_pct: number;
    dishes_with_descs: number;
    dishes_missing_descs: number;
    desc_coverage_pct: number;
  };
  categories: Array<{
    category_name: string;
    total_items: number;
    photos_present: number;
    photos_missing: number;
    descs_present: number;
    descs_missing: number;
  }>;
  missing_photos_all: Array<{ category: string; dish: string }>;
  missing_descs_all: Array<{ category: string; dish: string }>;
}

export interface DualComparisonReportData {
  zomatoData: SingleAuditReportData;
  swiggyData: SingleAuditReportData;
  comparison: {
    restaurant_name: string;
    zomatoScore: number;
    swiggyScore: number;
    zomatoTotalItems: number;
    swiggyTotalItems: number;
    zomatoPhotoPct: number;
    swiggyPhotoPct: number;
    zomatoDescPct: number;
    swiggyDescPct: number;
    missingOnSwiggy: Array<{ dish: string; category: string; zomatoPrice?: number }>;
    missingOnZomato: Array<{ dish: string; category: string; swiggyPrice?: number }>;
    photoGaps: Array<{ dish: string; hasOnZomato: boolean; hasOnSwiggy: boolean }>;
    descGaps: Array<{ dish: string; hasOnZomato: boolean; hasOnSwiggy: boolean }>;
    priceVariances: Array<{ dish: string; zomatoPrice: number; swiggyPrice: number; diff: number }>;
  };
}

export function generateSingleAuditReportHtml(data: SingleAuditReportData): string {
  const currentDate = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Hygiene Audit Report - ${data.restaurant_name}</title>
    <style>
        @page {
            size: A4 portrait;
            margin: 0;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'Segoe UI', Arial, sans-serif;
            background-color: #ffffff;
            color: #2C322C;
            width: 210mm;
            height: 297mm;
            padding: 12mm;
        }
        .outer-frame {
            border: 5px solid #989B5F;
            padding: 4px;
            height: 100%;
        }
        .inner-frame {
            border: 2px solid #989B5F;
            height: 100%;
            padding: 20px 24px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
        }
        .header {
            text-align: center;
            border-b: 1px solid #989B5F;
            padding-bottom: 12px;
        }
        .header img {
            height: 48px;
            margin-bottom: 4px;
        }
        .header h1 {
            font-size: 18px;
            letter-spacing: 2px;
            text-transform: uppercase;
            color: #2F3119;
        }
        .sub-header {
            font-size: 14px;
            color: #666;
            margin-top: 2px;
        }
        .doc-meta {
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            margin-top: 10px;
            padding-bottom: 8px;
            border-bottom: 1px solid #e2e8f0;
            font-weight: bold;
        }
        .score-card {
            background-color: #f8fafc;
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            padding: 14px;
            margin-top: 12px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .score-big {
            font-size: 32px;
            font-weight: 900;
            color: #2F3119;
        }
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 10px;
            margin-top: 12px;
        }
        .metric-box {
            background: #fff;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 8px;
            text-align: center;
        }
        .metric-box .num {
            font-size: 16px;
            font-weight: bold;
            color: #0f172a;
        }
        .metric-box .label {
            font-size: 10px;
            color: #64748b;
            text-transform: uppercase;
        }
        .section-title {
            font-size: 12px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #2F3119;
            margin-top: 14px;
            margin-bottom: 6px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10px;
        }
        th, td {
            border: 1px solid #cbd5e1;
            padding: 5px 8px;
            text-align: left;
        }
        th {
            background-color: #f1f5f9;
            font-weight: bold;
            color: #334155;
        }
        .footer {
            border-t: 1px solid #989B5F;
            padding-top: 10px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            font-size: 10px;
        }
        .badge-green { background: #dcfce7; color: #166534; padding: 2px 6px; border-radius: 4px; font-weight: bold; }
        .badge-red { background: #fee2e2; color: #991b1b; padding: 2px 6px; border-radius: 4px; font-weight: bold; }
    </style>
</head>
<body>
    <div class="outer-frame">
        <div class="inner-frame">
            <div>
                <div class="header">
                    <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" alt="Logo" style="display:none;" />
                    <h1>ETHERS CONSULTANCY</h1>
                    <div class="sub-header">Menu Hygiene Audit Report — ${data.platform.toUpperCase()}</div>
                </div>

                <div class="doc-meta">
                    <div>Restaurant: <strong>${data.restaurant_name}</strong></div>
                    <div>Platform: <strong>${data.platform.toUpperCase()}</strong></div>
                    <div>Date: <strong>${currentDate}</strong></div>
                </div>

                <div class="score-card">
                    <div>
                        <div style="font-size: 11px; text-transform: uppercase; font-weight: bold; color: #64748b;">Overall Hygiene Score</div>
                        <div class="score-big">${data.scorecard.overall_score}<span style="font-size: 16px; color: #94a3b8;">/100</span></div>
                    </div>
                    <div style="text-align: right; font-size: 11px; line-height: 1.6;">
                        <div>Photo Coverage: <strong>${data.scorecard.photo_coverage_pct}%</strong></div>
                        <div>Description Coverage: <strong>${data.scorecard.desc_coverage_pct}%</strong></div>
                        <div>Total Menu Items: <strong>${data.scorecard.total_dishes}</strong></div>
                    </div>
                </div>

                <div class="metrics-grid">
                    <div class="metric-box">
                        <div class="num">${data.scorecard.total_dishes}</div>
                        <div class="label">Total Dishes</div>
                    </div>
                    <div class="metric-box">
                        <div class="num" style="color:#166534;">${data.scorecard.dishes_with_photos}</div>
                        <div class="label">Photos Present</div>
                    </div>
                    <div class="metric-box">
                        <div class="num" style="color:#991b1b;">${data.scorecard.dishes_missing_photos}</div>
                        <div class="label">Missing Photos</div>
                    </div>
                    <div class="metric-box">
                        <div class="num" style="color:#991b1b;">${data.scorecard.dishes_missing_descs}</div>
                        <div class="label">Missing Descs</div>
                    </div>
                </div>

                <div class="section-title">Category Breakdown</div>
                <table>
                    <thead>
                        <tr>
                            <th>Category</th>
                            <th>Total Items</th>
                            <th>Photo Coverage</th>
                            <th>Desc Coverage</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.categories.slice(0, 8).map(c => `
                            <tr>
                                <td><strong>${c.category_name}</strong></td>
                                <td>${c.total_items}</td>
                                <td>${c.photos_present}/${c.total_items} (${c.total_items ? Math.round((c.photos_present/c.total_items)*100) : 0}%)</td>
                                <td>${c.descs_present}/${c.total_items} (${c.total_items ? Math.round((c.descs_present/c.total_items)*100) : 0}%)</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                ${data.missing_photos_all.length > 0 ? `
                <div class="section-title" style="color:#991b1b;">Sample Dishes Missing Photos</div>
                <table>
                    <thead>
                        <tr><th>Category</th><th>Dish Name</th></tr>
                    </thead>
                    <tbody>
                        ${data.missing_photos_all.slice(0, 6).map(m => `
                            <tr><td>${m.category}</td><td>${m.dish}</td></tr>
                        `).join('')}
                    </tbody>
                </table>
                ` : ''}
            </div>

            <div class="footer">
                <div>Ethers Consultancy • F&B Hygiene Analytics</div>
                <div>Official Computer Generated Report</div>
            </div>
        </div>
    </div>
</body>
</html>`;
}

export function generateDualComparisonReportHtml(data: DualComparisonReportData): string {
  const currentDate = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const { comparison } = data;

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Dual-Platform Hygiene Comparison - ${comparison.restaurant_name}</title>
    <style>
        @page { size: A4 portrait; margin: 0; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'Segoe UI', Arial, sans-serif;
            background-color: #ffffff;
            color: #2C322C;
            width: 210mm;
            height: 297mm;
            padding: 12mm;
        }
        .outer-frame { border: 5px solid #989B5F; padding: 4px; height: 100%; }
        .inner-frame {
            border: 2px solid #989B5F;
            height: 100%;
            padding: 20px 24px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
        }
        .header { text-align: center; border-bottom: 1px solid #989B5F; padding-bottom: 10px; }
        .header h1 { font-size: 18px; letter-spacing: 2px; text-transform: uppercase; color: #2F3119; }
        .sub-header { font-size: 13px; color: #64748b; font-weight: bold; margin-top: 2px; }
        .doc-meta { display: flex; justify-content: space-between; font-size: 11px; margin-top: 10px; padding-bottom: 8px; border-bottom: 1px solid #e2e8f0; }
        
        .compare-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 12px; }
        .platform-card { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; }
        .platform-card.zomato { border-left: 4px solid #cb202d; }
        .platform-card.swiggy { border-left: 4px solid #fc8019; }
        .platform-title { font-size: 13px; font-weight: bold; margin-bottom: 8px; }
        .score-val { font-size: 26px; font-weight: 900; color: #0f172a; }
        
        .section-title { font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; color: #2F3119; margin-top: 12px; margin-bottom: 6px; }
        table { width: 100%; border-collapse: collapse; font-size: 10px; }
        th, td { border: 1px solid #cbd5e1; padding: 5px 7px; text-align: left; }
        th { background-color: #f1f5f9; font-weight: bold; color: #334155; }
        .badge-missing { background: #fee2e2; color: #991b1b; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 9px; }
        .badge-diff { background: #fef3c7; color: #92400e; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 9px; }
        .footer { border-top: 1px solid #989B5F; padding-top: 8px; display: flex; justify-content: space-between; font-size: 10px; }
    </style>
</head>
<body>
    <div class="outer-frame">
        <div class="inner-frame">
            <div>
                <div class="header">
                    <h1>ETHERS CONSULTANCY</h1>
                    <div class="sub-header">Dual-Platform Hygiene & Cross-Sync Audit</div>
                </div>

                <div class="doc-meta">
                    <div>Restaurant: <strong>${comparison.restaurant_name}</strong></div>
                    <div>Comparison: <strong>Zomato vs Swiggy</strong></div>
                    <div>Date: <strong>${currentDate}</strong></div>
                </div>

                <div class="compare-grid">
                    <div class="platform-card zomato">
                        <div class="platform-title" style="color: #cb202d;">ZOMATO AUDIT</div>
                        <div class="score-val">${comparison.zomatoScore}<span style="font-size:14px; color:#64748b;">/100</span></div>
                        <div style="font-size: 10px; margin-top: 6px; line-height: 1.5;">
                            <div>Total Items: <strong>${comparison.zomatoTotalItems}</strong></div>
                            <div>Photo Coverage: <strong>${comparison.zomatoPhotoPct}%</strong></div>
                            <div>Desc Coverage: <strong>${comparison.zomatoDescPct}%</strong></div>
                        </div>
                    </div>

                    <div class="platform-card swiggy">
                        <div class="platform-title" style="color: #fc8019;">SWIGGY AUDIT</div>
                        <div class="score-val">${comparison.swiggyScore}<span style="font-size:14px; color:#64748b;">/100</span></div>
                        <div style="font-size: 10px; margin-top: 6px; line-height: 1.5;">
                            <div>Total Items: <strong>${comparison.swiggyTotalItems}</strong></div>
                            <div>Photo Coverage: <strong>${comparison.swiggyPhotoPct}%</strong></div>
                            <div>Desc Coverage: <strong>${comparison.swiggyDescPct}%</strong></div>
                        </div>
                    </div>
                </div>

                ${comparison.missingOnSwiggy.length > 0 ? `
                <div class="section-title">Items Present on Zomato but MISSING on Swiggy (${comparison.missingOnSwiggy.length} Items)</div>
                <table>
                    <thead>
                        <tr><th>Category</th><th>Dish Name</th><th>Zomato Price</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                        ${comparison.missingOnSwiggy.slice(0, 5).map(m => `
                            <tr>
                                <td>${m.category}</td>
                                <td><strong>${m.dish}</strong></td>
                                <td>₹${m.zomatoPrice || '-'}</td>
                                <td><span class="badge-missing">Missing on Swiggy</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                ` : ''}

                ${comparison.missingOnZomato.length > 0 ? `
                <div class="section-title">Items Present on Swiggy but MISSING on Zomato (${comparison.missingOnZomato.length} Items)</div>
                <table>
                    <thead>
                        <tr><th>Category</th><th>Dish Name</th><th>Swiggy Price</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                        ${comparison.missingOnZomato.slice(0, 5).map(m => `
                            <tr>
                                <td>${m.category}</td>
                                <td><strong>${m.dish}</strong></td>
                                <td>₹${m.swiggyPrice || '-'}</td>
                                <td><span class="badge-missing">Missing on Zomato</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                ` : ''}

                ${comparison.priceVariances.length > 0 ? `
                <div class="section-title">Price Variance & Discrepancies</div>
                <table>
                    <thead>
                        <tr><th>Dish Name</th><th>Zomato Price</th><th>Swiggy Price</th><th>Variance</th></tr>
                    </thead>
                    <tbody>
                        ${comparison.priceVariances.slice(0, 5).map(p => `
                            <tr>
                                <td><strong>${p.dish}</strong></td>
                                <td>₹${p.zomatoPrice}</td>
                                <td>₹${p.swiggyPrice}</td>
                                <td><span class="badge-diff">₹${Math.abs(p.diff)} diff</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                ` : ''}
            </div>

            <div class="footer">
                <div>Ethers Consultancy • Cross-Platform Sync Intelligence</div>
                <div>Official Computer Generated Report</div>
            </div>
        </div>
    </div>
</body>
</html>`;
}
