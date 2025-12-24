<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <title>請求書</title>
    <style>
        /* PDF化のためのA4設定 */
        @page {
            size: A4;
            margin: 20mm;
        }
        
        body {
            font-family: "ipaexg", "Noto Sans JP", "HeiseiMinchoStd-W3", sans-serif; /* 日本語フォント指定 */
            font-size: 11pt;
            color: #333;
            line-height: 1.5;
            margin: 0;
            padding: 0;
        }

        /* レイアウト用コンテナ */
        .container {
            width: 100%;
        }

        /* ヘッダー周り */
        .header-top {
            display: flex;
            justify-content: space-between;
            margin-bottom: 20px;
        }
        .title {
            text-align: center;
            font-size: 24pt;
            font-weight: bold;
            letter-spacing: 5px;
            margin-bottom: 40px;
            border-bottom: 3px double #333;
            padding-bottom: 10px;
        }

        /* 宛名と発行元 */
        .info-section {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 30px;
        }
        .client-info {
            width: 55%;
        }
        .client-name {
            font-size: 16pt;
            border-bottom: 1px solid #333;
            padding-bottom: 5px;
            display: inline-block;
            margin-bottom: 10px;
        }
        .sender-info {
            width: 40%;
            text-align: right;
            font-size: 10pt;
        }
        .sender-name {
            font-size: 14pt;
            font-weight: bold;
            margin-bottom: 5px;
        }

        /* 請求詳細（件名・期限・振込先） */
        .meta-info {
            margin-bottom: 20px;
            border: 1px solid #ccc;
            padding: 10px;
        }
        .meta-row {
            display: flex;
            margin-bottom: 5px;
        }
        .meta-label {
            width: 100px;
            font-weight: bold;
        }

        /* 合計金額の強調表示 */
        .total-banner {
            text-align: center;
            border-bottom: 2px solid #000;
            margin-bottom: 20px;
            padding: 10px;
        }
        .total-label {
            font-size: 12pt;
        }
        .total-amount {
            font-size: 18pt;
            font-weight: bold;
        }

        /* テーブルスタイル */
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        }
        th, td {
            border: 1px solid #888;
            padding: 8px;
            font-size: 10pt;
        }
        th {
            background-color: #f2f2f2;
            text-align: center;
        }
        td.num {
            text-align: right;
        }
        td.center {
            text-align: center;
        }

        /* 合計欄 */
        .summary-table {
            width: 40%;
            margin-left: auto;
        }
        .summary-table th {
            background-color: #f9f9f9;
        }

        /* 備考 */
        .notes {
            margin-top: 30px;
            border-top: 1px solid #ccc;
            padding-top: 10px;
            font-size: 9pt;
        }
    </style>
</head>
<body>

    <div class="title">{{ title }}</div>

    <div style="text-align: right; margin-bottom: 10px;">
        <div>請求日：{{ invoice_date }}</div>
        <div>No. {{ invoice_number }}</div>
    </div>

    <div class="info-section">
        <div class="client-info">
            <span class="client-name">{{ client_name }} 御中</span><br>
            <p>下記のとおり、御請求申し上げます。</p>
        </div>

        <div class="sender-info">
            <div class="sender-name">{{ sender_name }}</div>
            <div>〒{{ sender_zip }}</div>
            <div>{{ sender_address }}</div>
            <div>{{ sender_building }}</div>
            <div>TEL: {{ sender_tel }}</div>
            <div>担当: {{ sender_pic }}</div>
        </div>
    </div>

    <div class="total-banner">
        <span class="total-label">ご請求金額：</span>
        <span class="total-amount">¥ {{ "{:,}".format(total_amount_incl_tax) }} - (税込)</span>
    </div>

    <div class="meta-info">
        <div class="meta-row">
            <span class="meta-label">件名</span>
            <span>{{ subject }}</span>
        </div>
        <div class="meta-row">
            <span class="meta-label">支払期限</span>
            <span>{{ due_date }}</span>
        </div>
        <div class="meta-row">
            <span class="meta-label">振込先</span>
            <span>
                {{ bank_name }} {{ bank_branch }}<br>
                {{ bank_type }} {{ bank_number }}
            </span>
        </div>
    </div>

    <table>
        <thead>
            <tr>
                <th style="width: 50%;">摘要</th>
                <th style="width: 10%;">数量</th>
                <th style="width: 10%;">単位</th>
                <th style="width: 15%;">単価</th>
                <th style="width: 15%;">金額</th>
            </tr>
        </thead>
        <tbody>
            {% for item in items %}
            <tr>
                <td>{{ item.name }}</td>
                <td class="num">{{ item.quantity }}</td>
                <td class="center">{{ item.unit }}</td>
                <td class="num">{{ "{:,}".format(item.unit_price) }}</td>
                <td class="num">{{ "{:,}".format(item.amount) }}</td>
            </tr>
            {% endfor %}
            
            </tbody>
    </table>

    <table class="summary-table">
        <tr>
            <th>小計</th>
            <td class="num">¥ {{ "{:,}".format(subtotal) }}</td>
        </tr>
        <tr>
            <th>消費税</th>
            <td class="num">¥ {{ "{:,}".format(tax_amount) }}</td>
        </tr>
        <tr>
            <th style="background-color: #e6e6e6;">合計</th>
            <td class="num" style="font-weight: bold;">¥ {{ "{:,}".format(total_amount_incl_tax) }}</td>
        </tr>
    </table>

    <div class="notes">
        <strong>備考:</strong><br>
        {{ remarks }}
    </div>

</body>
</html>