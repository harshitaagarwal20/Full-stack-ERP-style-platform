import pandas as pd
import re
from rapidfuzz import process, fuzz

sales_file = r"C:\Users\harsh\OneDrive\Documents\sales_karani.xlsx"
master_file = r"C:\Users\harsh\Downloads\Customer name.xlsx"
output_file = r"C:\Users\harsh\Downloads\karani_sales_matched.xlsx"

df = pd.read_excel(sales_file)
master = pd.read_excel(master_file)

df.columns = df.columns.str.strip()
master.columns = master.columns.str.strip()

sales_col = "Customer Name"
master_col = master.columns[0]

def clean_name(text):
    if pd.isna(text):
        return ""

    text = str(text).upper()

    # Remove city/location inside brackets
    # Example: BAKM LIFE STYLE (KARAIKAL) -> BAKM LIFE STYLE
    text = re.sub(r"\(.*?\)", " ", text)

    # Remove special characters
    text = re.sub(r"[^A-Z0-9 ]", " ", text)

    # Remove extra spaces
    text = re.sub(r"\s+", " ", text).strip()

    return text

df["Customer Name Clean"] = df[sales_col].apply(clean_name)
master["Master Clean Name"] = master[master_col].apply(clean_name)

master_unique = master.dropna(subset=["Master Clean Name"])
master_unique = master_unique[master_unique["Master Clean Name"] != ""]
master_unique = master_unique.drop_duplicates(subset=["Master Clean Name"])

master_names = master_unique["Master Clean Name"].tolist()

lookup = dict(
    zip(master_unique["Master Clean Name"], master_unique[master_col])
)

def fuzzy_match(name):
    if pd.isna(name) or str(name).strip() == "":
        return pd.Series(["NOT FOUND", 0, "NOT FOUND"])

    match = process.extractOne(
        name,
        master_names,
        scorer=fuzz.token_set_ratio
    )

    if match and match[1] >= 75:
        matched_clean = match[0]
        score = match[1]
        final_name = lookup.get(matched_clean, "NOT FOUND")
        return pd.Series([matched_clean, score, final_name])

    return pd.Series([
        "NOT FOUND",
        match[1] if match else 0,
        "NOT FOUND"
    ])

df[["Matched Clean Name", "Match Score", "Correct Customer Name"]] = (
    df["Customer Name Clean"].apply(fuzzy_match)
)

df["Review Required"] = df["Match Score"] < 90

cols = df.columns.tolist()

for col in [
    "Correct Customer Name",
    "Matched Clean Name",
    "Match Score",
    "Review Required"
]:
    if col in cols:
        cols.remove(col)

insert_position = cols.index(sales_col) + 1

cols.insert(insert_position, "Correct Customer Name")
cols.insert(insert_position + 1, "Match Score")
cols.insert(insert_position + 2, "Review Required")
cols.append("Matched Clean Name")

df = df[cols]

df.to_excel(output_file, index=False, engine="openpyxl")

print("Output saved:", output_file)