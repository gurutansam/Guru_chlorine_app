// In your backend/routes/dashboardRoutes.js or similar
import express from 'express';
import db from '../utils/db.js';
import {getDashboardData,getDailyCounts,addDistrictOfficer,getDistrictData,getMosMunicipalities,addHUD,updateHUD,deleteHUD, getVillageUsers, addVillageUser,updateVillageUser,deleteVillageUser, getHUDs,addHudBlock,getHudBlocks,updateHudBlock,deleteHudBlock,getHudMasterUsers,addHudMasterUser,
  updateHudMasterUser,deleteHudMasterUser,addVillage,updateVillage,deleteVillage,getSavePlanStatus,addBlockUser,getBlockUsers,updateBlockUser,deleteBlockUser,
  getVillages,getDistrictOfficers,addDataCollection,getDataCollection,addHiMonitoring,getHiMonitoring,addChlorinationHub,addChlorinationDistrict,getHudChlorineData,getHudChlorineDataPaginated,addHudChlorineDataEntry,
  getAllHubsWithDistricts,addCorporationMaster,addMunicipalityMaster,getMunicipalityMaster,addTownPanchayatMaster,addGovernmentHospital,saveVillageWaterSamplePlan,getVillageWaterSamplePlans,getDatewiseCountByUser,getDatewiseUserCountDetails,
  addChlorinationUser,getOfficerCount,addChlorineUserDataEntry,getChlorinationDistrictsByHub,getTownPanchayatMaster,getGovernmentHospitals,getChlorinationDataCollectorById, deleteChlorinationDataCollector,
  getChlorinationUsers,addChlorinationDataCollector,getChlorineDataByHubId,getChlorinationDataCollectors,getChlorinationDataCollection,addMosquitoDistrict, getMosquitoDistricts,
  addRailwayStationMaster,getRailwayStationMaster,addApprovedHomesMaster,getApprovedHomesMaster,addPrisonMaster,getPrisonMaster,addTempleFestival,
  getGovernmentInstitutionMaster,addGovernmentInstitutionMaster,addEducationalInstitutionMaster,getEducationalInstitutionMaster,addPWDMaster,getPWDMaster,getTempleFestivals,updateDistrictOfficer,deleteDistrictOfficer,
  getHubMasterData,getMosquitoBlocks,addCorpUser,getCorpUsers, updateCorpUser,deleteCorpUser,addCorporation,getCorporations, updateCorporation,getCorpMasterUsers,addCorpMasterUser, updateCorpMasterUser, deleteCorpMasterUser,getMosMunMasterUsers,addMosMunMasterUser,updateMosMunMasterUser,deleteMosMunMasterUser,
  savePlanStatus,getMosquitoMunicipalityUsers,addMosquitoMunicipalityUser,updateMosquitoMunicipalityUser,addMosMunicipality,updateMosMunicipality,deleteMosMunicipality,
  deleteMosquitoMunicipalityUser,getMosquitoMunicipalityUserById,deleteCorporation, addMosquitoBlock,addMosquitoBlockUser,getMosquitoBlockById,deleteMosquitoBlockById,getMosquitoBlockUsers,updateMosquitoBlockUser,deleteMosquitoBlockUser,addMosBlockCollector, deleteMosBlockCollector,getMosBlockCollectorById,
  updateMosBlockCollector,getMosBlockCollectors,getCorporationMaster,getInspectionPlan,getChlorinationHubUserById,updateChlorinationDataCollector,updateChlorinationHubUser,deleteChlorinationHubUser,addGovtHoliday,getGovtHolidays,updateMosquitoBlockName,
  addPhc,getPhcs,updatePhc,deletePhc,saveLarvaEntry,getLarvaEntries, addSpecialLarvaEntry, getSpecialLarvaEntries, getChlorineSummary,saveAction,getHiMonitoringSummary,getLarvaSummary,getLarvaSummaryCounts,getDateWiseLarvaIndexesWithActions,
  getChlorinePPMSummary,getChlorineSummaryByHudId,addSpecialChlorineDataEntry,getSpecialChlorineData,addBlockChlorineUserDataEntry,getBlockChlorineData,getHouseIndexCategorySummary, addSpecialHiMonitoring,  getSpecialHiMonitoring,getHiHudSummaryToday,  getActiveHiDetails,
  getInactiveHiDetails, getFilteredHudHiSummary, getFilteredActiveHiDetails, getFilteredInactiveHiDetails,getHudBlockChlorineData,getLarvaCounts,getActionCounts, getUserOverallCounts, getHudDashboardSummary} from '../controllers/dashboardController.js';

const router = express.Router();

router.post('/', getDashboardData);
router.get("/daily-counts", getDailyCounts);
router.get('/district', getDistrictData);
router.get('/district-officers', getDistrictOfficers);
router.post('/add-district-officer', addDistrictOfficer);
router.post('/datacollection', addDataCollection);
router.get('/datacollection', getDataCollection);
router.get('/datacollection/count-by-date', getDatewiseCountByUser);
router.get('/datacollection/details-by-date', getDatewiseUserCountDetails);
router.post('/hi-monitoring', addHiMonitoring);
router.get('/hi-monitoring', getHiMonitoring);
router.get('/hi-monitoring-summary', getHiMonitoringSummary);
router.post('/dbc-special-data-entry', addSpecialHiMonitoring);
router.get('/dbc-special-data-entry', getSpecialHiMonitoring);

router.post('/mos-district', addMosquitoDistrict);
router.get('/mos-district', getMosquitoDistricts);
router.get("/mosquito-blocks", getMosquitoBlocks);
router.post("/mosquito-blocks", addMosquitoBlock);
router.post("/mosquito-block-user", addMosquitoBlockUser);
router.get("/mosquito-block-users", getMosquitoBlockUsers);
router.post('/mos-block-add-collectors', addMosBlockCollector);
router.get('/mos-block-add-collectors', getMosBlockCollectors);
router.get("/mos-block-collector/:user_id", getMosBlockCollectorById);
router.put("/mos-block-collector/:user_id", updateMosBlockCollector);
router.delete("/mos-block-collector/:user_id", deleteMosBlockCollector);
router.post('/add-corp-user', addCorpUser);
router.get('/corp-users', getCorpUsers);
router.put('/update-corp-user/:user_id', updateCorpUser);
router.delete('/delete-corp-user/:user_id', deleteCorpUser);
router.get("/corp-master-users", getCorpMasterUsers); 
router.post("/add-corp-master-user", addCorpMasterUser); 
router.put("/update-corp-master-user/:user_id", updateCorpMasterUser); 
router.delete("/delete-corp-master-user/:user_id", deleteCorpMasterUser); 
router.get("/mos-corporation", getCorporations);
router.post("/mos-corporation", addCorporation);
router.put("/update-mos-corporation/:corporation_code", updateCorporation);
router.delete("/delete-mos-corporation/:corporation_code", deleteCorporation);
//Municipality Login Master Users
router.get("/mosquito-municipality-master-users", getMosMunMasterUsers);
router.post("/mosquito-municipality-master-users", addMosMunMasterUser);
router.put("/mosquito-municipality-master-users/:user_id", updateMosMunMasterUser);
router.delete("/mosquito-municipality-master-users/:user_id", deleteMosMunMasterUser);
//Municipality Health Inspector
router.get("/mosquito-municipality-collectors", getMosquitoMunicipalityUsers);
router.post("/mosquito-municipality-collector", addMosquitoMunicipalityUser);
router.put("/mosquito-municipality-collector/:user_id", updateMosquitoMunicipalityUser);
router.get("/mosquito-municipality-collector/:user_id", getMosquitoMunicipalityUserById);
router.delete("/mosquito-municipality-collector/:user_id", deleteMosquitoMunicipalityUser);
//Municipality Master Table
router.post('/mos-municipalities', addMosMunicipality);
router.get('/mos-municipalities', getMosMunicipalities);
router.put('/mos-municipalities/:municipality_id', updateMosMunicipality);
router.delete('/mos-municipalities/:municipality_id', deleteMosMunicipality);


router.get('/officer-count', getOfficerCount);
router.post('/save-larva-entry', saveLarvaEntry);
// GET all larva entries
router.get("/get-larva-entries", getLarvaEntries);
router.get(
  "/date-wise-index",
  getDateWiseLarvaIndexesWithActions
);

router.post('/dbc-special-data-entry-larval', addSpecialLarvaEntry);
router.get("/get-special-larva-entries", getSpecialLarvaEntries);

router.get("/chl-summary", getChlorineSummary);
router.get("/chl-summary/hud", getChlorineSummaryByHudId);
router.get('/larva-summary', getLarvaSummary);
router.get('/larva-summary-counts', getLarvaSummaryCounts);

router.post('/save-action', saveAction);
// HUD API calls
router.get('/hud', getHUDs);
router.post('/hud', addHUD);
router.put("/hud/:hud_id", updateHUD);
router.delete("/hud/:hud_id", deleteHUD);
router.post("/hud-blocks", addHudBlock);
router.get("/hud-blocks", getHudBlocks);
router.put("/hud-blocks/:block_id", updateHudBlock);
router.delete("/hud-blocks/:block_id", deleteHudBlock);
router.get('/hud-master-users', getHudMasterUsers);
router.post('/add-hud-master-user', addHudMasterUser);
router.put('/update-hud-master-user/:user_id', updateHudMasterUser);
router.delete('/delete-hud-master-user/:user_id', deleteHudMasterUser);
router.route('/block-users')
  .get(getBlockUsers)
  .post(addBlockUser);

router.route('/block-users/:user_id')
  .put(updateBlockUser)
  .delete(deleteBlockUser);

router.post("/phc", addPhc);
router.get("/phc", getPhcs);
router.put("/phc/:phc_id", updatePhc);
router.delete("/phc/:phc_id", deletePhc);


router.post('/village', addVillage);
router.get('/village', getVillages);
router.put("/village/:village_id", updateVillage);
router.delete("/village/:village_id", deleteVillage);
router.get("/village-user", getVillageUsers);
router.post("/village-user", addVillageUser);
router.put("/village-users/:user_id", updateVillageUser);
router.delete('/village-users/:user_id', deleteVillageUser);
router.post('/chl_hud_datacollection', addHudChlorineDataEntry);
router.get('/chl_hud_datacollection', getHudChlorineData);
router.get('/chl_hud_datacollection_paginated', getHudChlorineDataPaginated);
router.get('/chl_hud_dashboard_summary', getHudDashboardSummary);
router.post("/village-water-plan", saveVillageWaterSamplePlan);
router.get("/village-water-plan", getVillageWaterSamplePlans);

// Chlorination master
router.post('/hub', addChlorinationHub);
router.post('/district', addChlorinationDistrict);
router.get('/hubs-districts', getAllHubsWithDistricts);
router.get('/chl-districts-by-hub', getChlorinationDistrictsByHub);
router.post("/corporation-master", addCorporationMaster);
router.get('/corporation-master', getCorporationMaster);
router.post("/municipality-master", addMunicipalityMaster);
router.get("/municipality-master", getMunicipalityMaster);
router.post("/townpanchayat-master", addTownPanchayatMaster);
router.get("/townpanchayat-master", getTownPanchayatMaster);
router.post("/government-hospital-master", addGovernmentHospital);
router.get("/government-hospital-master", getGovernmentHospitals);
router.post("/railway-station-master", addRailwayStationMaster);
router.get("/railway-station-master", getRailwayStationMaster);
router.post("/approved-homes-master", addApprovedHomesMaster);
router.get("/approved-homes-master", getApprovedHomesMaster);
router.post("/prison-master", addPrisonMaster);
router.get("/prison-master", getPrisonMaster);
router.get("/government-institution-master", getGovernmentInstitutionMaster);
router.post("/government-institution-master", addGovernmentInstitutionMaster);
router.post("/pwd-master", addPWDMaster);
router.get("/pwd-master", getPWDMaster);
router.post('/temple-festival-master', addTempleFestival);
router.get('/temple-festival-master', getTempleFestivals);
// routes/dashboardRoutes.js
router.post('/educational-institution-master', addEducationalInstitutionMaster);
router.get('/educational-institution-master', getEducationalInstitutionMaster);
// Chlorination hub master data
// router.get('/chl-hub-master-data', getHubMasterData);
router.get("/chl-hub-master-data", getHubMasterData);
router.get('/inspection-plan', getInspectionPlan);

// Chlorination user creation
router.post('/chl-hubusers', addChlorinationUser);
router.get('/chl-hubusers', getChlorinationUsers);
router.get('/chl-hubusers/:user_id',getChlorinationHubUserById);
router.put('/chl-hubusers/:user_id', updateChlorinationHubUser);

// Chlorination inspection tester creation
router.post('/add-chl-datacollector', addChlorinationDataCollector)
router.get('/chl-datacollector', getChlorinationDataCollectors)
router.post('/chl_datacollection', addChlorineUserDataEntry);
router.get('/chl_datacollection', getChlorinationDataCollection); 
router.get("/chl_datacollection/hubid", getChlorineDataByHubId);
router.get("/chl-datacollector/:user_id", getChlorinationDataCollectorById);
router.put('/chl-datacollector/:user_id', updateChlorinationDataCollector);
router.delete('/chl-datacollector/:user_id', deleteChlorinationDataCollector);
router.delete('/chl-hubusers/:user_id', deleteChlorinationHubUser);
router.post("/govt-holidays", addGovtHoliday);
router.get("/govt-holidays", getGovtHolidays);
router.put('/update-district-officer/:user_id', updateDistrictOfficer);
router.delete('/delete-district-officer/:user_id', deleteDistrictOfficer);
router.put('/mosquito-block-user/:user_id', updateMosquitoBlockUser);
router.delete('/mosquito-block-user/:user_id', deleteMosquitoBlockUser);
router.get("/mosquito-blocks/:block_id", getMosquitoBlockById);
router.delete("/mosquito-blocks/:block_id", deleteMosquitoBlockById);
router.put("/mosquito-blocks/:block_id", updateMosquitoBlockName); 

router.post('/save-plan-status', savePlanStatus);
router.get('/get-save-plan-status', getSavePlanStatus);
// router.get('/getSavedPlanStatus', getSavedPlanStatus);

// Developer dashboard specific route
router.get("/ppm-summary", getChlorinePPMSummary);

//Chlorination Block user data entry
router.post('/chl_block_datacollection', addBlockChlorineUserDataEntry);
router.get('/get_chl_block_datacollection', getBlockChlorineData);
// HUD-scoped block chlorine data
router.get(
  "/get_hud_block_chlorine_data",
  getHudBlockChlorineData
);

//special Chlorine data entry
router.post('/chl_special_datacollection', addSpecialChlorineDataEntry);
router.get('/get_chl_special_datacollection', getSpecialChlorineData);

router.get(
  "/house-index",
getHouseIndexCategorySummary);

router.get("/hi-user-data", getHiHudSummaryToday);
router.get("/hi-active-details", getActiveHiDetails);
router.get("/hi-inactive-details", getInactiveHiDetails);

//count routes
router.get('/user-overall-counts', getUserOverallCounts);
router.get('/larva-counts', getLarvaCounts);
router.get('/action-counts', getActionCounts);



// Shows ONLY logged-in user's HUD
router.get(
  "/hi-filtered-data",
  getFilteredHudHiSummary
);

/* ================= ACTIVE HI DETAILS ================= */
router.get(
  "/hi-active-filtered-details",
  getFilteredActiveHiDetails
);

/* ================= INACTIVE HI DETAILS ================= */
router.get(
  "/hi-inactive-filtered-details",
  getFilteredInactiveHiDetails
);

// Chlorination prediction route
router.get('/', (req, res) => {
  const { user_id, role, hub_id } = req.query;

  try {
    let data = [];
    if (role === 'admin') {
      data = db.prepare(`SELECT * FROM datacollection`).all();
    } else if (role === 'hub_officer') {
      // Only show data from districts under this hub
      data = db.prepare(`
        SELECT d.* FROM datacollection d
        JOIN district_officer_table o ON d.user_id = o.user_id
        WHERE o.hub_id = ?
      `).all(hub_id);
    } else {
      return res.status(403).json({ message: 'Unauthorized access' });
    }
    res.json({ data });
  } catch (err) {
    console.error('Dashboard fetch error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});
export default router;