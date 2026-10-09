const fs = require("fs");

function addLog(file, replacements) {
    let code = fs.readFileSync(file, "utf8");
    let changed = false;
    for (let r of replacements) {
        if (!code.includes(r.insert)) {
            code = code.replace(r.search, r.search + "\n" + r.insert);
            changed = true;
        }
    }
    if (changed) fs.writeFileSync(file, code);
}

// 1. HeritageSiteController
addLog("c:/Users/PC/Desktop/San-Fernando/backend/app/Http/Controllers/HeritageSiteController.php", [
    { search: "$heritageSite = HeritageSite::create($data);", insert: "        \\App\\Models\\AdminActivity::log(\"created\", \"HeritageSite\", $heritageSite->name);" },
    { search: "$heritageSite->update($data);", insert: "        \\App\\Models\\AdminActivity::log(isset($data[\"status\"]) && $data[\"status\"] === \"archived\" ? \"archived\" : \"updated\", \"HeritageSite\", $heritageSite->name);" }
]);

// 2. EventController
addLog("c:/Users/PC/Desktop/San-Fernando/backend/app/Http/Controllers/EventController.php", [
    { search: "$event = Event::create($data);", insert: "        \\App\\Models\\AdminActivity::log(\"created\", \"Event\", $event->title);" },
    { search: "$event->update($data);", insert: "        \\App\\Models\\AdminActivity::log(\"updated\", \"Event\", $event->title);" }
]);

// 3. HeritageContributionController
addLog("c:/Users/PC/Desktop/San-Fernando/backend/app/Http/Controllers/HeritageContributionController.php", [
    { search: "$contribution->save();", insert: "        \\App\\Models\\AdminActivity::log($contribution->status === \"approved\" ? \"approved\" : \"rejected\", \"VisitorContribution\", \"Contribution #\" . $contribution->id);" }
]);

// 4. HeritageCheckinController
addLog("c:/Users/PC/Desktop/San-Fernando/backend/app/Http/Controllers/HeritageCheckinController.php", [
    { search: "$config->save();", insert: "        \\App\\Models\\AdminActivity::log(\"updated\", \"CheckinConfig\", $heritageSite->name);" }
]);

// 5. Add page view increment to HeritageSiteController@show
let hsCode = fs.readFileSync("c:/Users/PC/Desktop/San-Fernando/backend/app/Http/Controllers/HeritageSiteController.php", "utf8");
if (!hsCode.includes("increment('page_views')")) {
    hsCode = hsCode.replace(
        "public function show(HeritageSite $heritageSite)\n    {\n        $heritageSite->load([",
        "public function show(HeritageSite $heritageSite)\n    {\n        $heritageSite->increment('page_views');\n        $heritageSite->load(["
    );
    fs.writeFileSync("c:/Users/PC/Desktop/San-Fernando/backend/app/Http/Controllers/HeritageSiteController.php", hsCode);
}
