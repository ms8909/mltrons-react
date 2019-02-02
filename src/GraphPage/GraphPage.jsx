import React from 'react';
import { Link } from 'react-router-dom';
import { connect } from 'react-redux';
import './graph.css'
import Dropzone from 'react-dropzone'
import {alertActions, projectActions} from '../_actions';
import classNames from 'classnames'
import TreeView from 'deni-react-treeview';
import 'react-table/react-table.css'
import {Line} from 'react-chartjs-2';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';
import Grid from '@material-ui/core/Grid';
import withStyles from '@material-ui/core/styles/withStyles';
import Button from '@material-ui/core/Button';
import { withRouter } from "react-router";
import Chip from '@material-ui/core/Chip';
import DoneIcon from '@material-ui/icons/Done';
import CircularProgress from '@material-ui/core/CircularProgress';
import Pusher from "pusher-js";

const styles = theme => ({
    root: {
        flexGrow: 1,
        backgroundColor: theme.palette.grey['100'],
        paddingBottom: 200,
        paddingTop: 50,
    },
    grid: {
        width: 1200,
        justifyContent: 'start',
        margin: `0 ${theme.spacing.unit * 2}px`,
        [theme.breakpoints.down('sm')]: {
            width: 'calc(100% - 20px)'
        }
    },
    loadingState: {
        opacity: 0.05
    },
    paper: {
        padding: theme.spacing.unit * 3,
        textAlign: 'left',
        color: theme.palette.text.secondary
    },
    treeView: {
        width: '100%',
        border: 0,
        height: 150,
        backgroundColor: '#FFF',
        color: 'rgba(0, 0, 0, 0.87)',
        fontSize: '0.875rem',
        fontFamily: "Roboto"
    },
    button: {
        margin: theme.spacing.unit,
        width: '80%'
    },
    upload: {
        marginLeft: '-8px'
    },
    datasetContainer:{
      maxHeight: '50vh',
      overflowY: 'scroll'
    },
    hiddenfile: {
        width: '0px',
        height: '0px',
        overflow: 'hidden'
    },
    statusItem: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingRight: 50
    },
    tablecontainer:{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        '& > table': {
            border: '1px solid',
            padding: 0,
            width: '75%',
            background: '#f5f5f5',
            '& > tr': {
                padding: 0,
                '& > th':{
                    background: '#4caf50',
                    margin: 7,
                    color: "#FFF",
                    textAlign: "center",
                    font: "bold 12pt roboto",
                    padding: 7
                },
                '& > td': {
                    font: "500 13px roboto",
                    margin: 7,
                    fontWeight: 'bold',
                    color: '#000',
                    padding: 4
                }
            }
        }
    }
});

let channelSubscriber;

class GraphPage extends React.Component {
    constructor(props){
        super(props);
        this.handleChange = this.handleChange.bind(this);
        this.proceedTesting = this.proceedTesting.bind(this);
        this.state = {
            selected : -1,
            progress: {step: -1},
            current: 0
        }
    }
    componentWillUnmount() {
        channelSubscriber.unbind();
    }
    componentDidMount() {
        const pusher = new Pusher('469a4013ee4603be5010', {
            cluster: 'ap2',
            forceTLS: true
        });
        const channel = pusher.subscribe(this.props.authentication.user.id.toString());
        channelSubscriber = channel;
        let context = this;
        channel.bind('test_csv', data => {
            console.log('progress csv here', data);
            if(data.message.step == 4){
                if(context.props.groups.deployed.length > 0){
                    let model_d = context.props.groups[0].model_d;
                    if(model_d.training.processed_file_d.parent == undefined){
                        dispatch(projectActions.getTestingSets(model_d.training.processed_file))
                    }
                    else{
                        for(let i of model_d.training.processed_file_d.parent.dataset){
                            dispatch(projectActions.getTestingSets(i))
                        }
                    }
                }
            }
            context.setState({
                progress: data.message
            })
        });

        channel.bind('generate_graph_csv', data => {
            console.log('progress csv here', data);
            context.setState({
                progress: data.message
            });
            if(data.message.step == 4){
                context.props.dispatch(projectActions.getTestingGraph(context.state.project_id));
            }
            else if(data.message.step == 5){
                context.setState({
                    progress: {step: -1}
                });
                context.props.dispatch(alertActions.error('Error generating graph.'));
            }
        });

        const { id } = this.props.match.params;
        this.setState({
            project_id: id,
        });
        this.props.dispatch(projectActions.getProject(id));
        this.props.dispatch(projectActions.getDeployedModel(id));
        this.props.dispatch(projectActions.getTestingGraph(id));
        this.props.dispatch(projectActions.getTaskProgress(id));
    }

    proceedTesting(){
        let model_id = this.props.groups.deployed[0].id;
        var r = confirm("Are you sure you want to start testing!");
        if (r == true) {
            console.log('proceed training', model_id);
            this.props.dispatch(projectActions.startTesting(model_id, this.state.project_id));
            this.setState({current: 1, progress: {step: 0}});
        }
    }

    handleChange(e) {
        console.log('files', e.target.files);
        let files = e.target.files;
        if(files.length > 0){
            this.setState({
                progress: {step: 0}
            })
        }
        for(let file of files) {
            var data = new FormData();
            data.append('file_url', file);
            data.append('data', this.state.data_id);
            data.append('project', this.state.project_id);
            this.props.dispatch(projectActions.addTraining(data, this.state.project_id));
        }
    }

    componentWillReceiveProps(nextProps) {
        let {groups} = this.props;
        let nextGroups = nextProps.groups;
        if (groups.project != nextGroups.project) {
            this.props.dispatch(projectActions.clearState());
            var sets = [];
            for (let set of nextGroups.project.datasets) {
                this.props.dispatch(projectActions.getDatasetMeta({id: set.id, name: set.name}))
            }
        }
        if(groups.task!=nextGroups.task){
            if(nextGroups.task.result.event == 'test_csv' || nextGroups.task.result.event == 'generate_graph_csv'){
                if(nextGroups.task.result.step!=5){
                    this.setState({
                        progress: nextGroups.task.result
                    })
                }
                else{
                    this.props.dispatch(alertActions.error('Error in task.'));
                }
            }

        }
    }

    render() {
        const { groups, classes } = this.props;

        const statusSteps = [
            {step: 0, text: 'Uploading testing data'},
            {step: 1, text: 'Reading raw data'},
            {step: 2, text: 'Saving data frame for testing'},
        ];

        const testingSteps = [
            {step: 0, text: 'Loading test data'},
            {step: 1, text: 'Transforming test data'},
            {step: 2, text: 'Predicting data'},
            {step: 3, text: 'Displaying data'},
        ];

        const steps = this.state.current == 0 ? statusSteps : testingSteps;

        const status = <Paper className={classes.paper}>
            <Typography variant="h6" gutterBottom>Status</Typography>
            <Grid container>
                {steps.map((obj) => (
                    <Grid item sm={3} className={classes.statusItem}>
                        <div>
                            <Typography variant="subtitle2" gutterBottom>
                                {obj.step+1}. {obj.text}
                            </Typography>
                            <Chip
                                label={this.state.progress.step > obj.step ? "100%" : '0%'}
                                color={this.state.progress.step > obj.step ? "primary" : this.state.progress.step == obj.step ? 'secondary': ''}
                            />
                        </div>
                        {
                            this.state.progress.step > obj.step &&
                            <DoneIcon color="primary"/>
                        }
                        {
                            this.state.progress.step == obj.step &&
                            <CircularProgress color="secondary" />
                        }
                    </Grid>
                ))}
            </Grid>
        </Paper>;



        const prediction_data = groups.graph && groups.graph.length > 0 &&{
            labels: groups.graph[0].data.x,
            datasets: [
                {
                    label: 'Prediction',
                    fill: false,
                    lineTension: 0.1,
                    backgroundColor: 'rgba(255,99,132,0.2)',
                    borderColor: 'rgba(255,99,132,1)',
                    borderCapStyle: 'butt',
                    borderDash: [],
                    borderDashOffset: 0.0,
                    borderJoinStyle: 'miter',
                    pointBorderColor: 'rgba(75,192,192,1)',
                    pointBackgroundColor: '#fff',
                    pointBorderWidth: 1,
                    pointHoverRadius: 5,
                    pointHoverBackgroundColor: 'rgba(75,192,192,1)',
                    pointHoverBorderColor: 'rgba(220,220,220,1)',
                    pointHoverBorderWidth: 2,
                    pointRadius: 1,
                    pointHitRadius: 0.01,
                    data: groups.graph[0].data.y
                },
            ]
        };


        return (
            <div className={classes.root}>
                <Grid container justify="center">
                    <Grid spacing={24} alignItems="start" justify="center" container className={classes.grid}>
                        <Grid item xs={12}>
                            {status}
                        </Grid>
                        <Grid item xs={3}>
                            <Paper className={classes.paper}>
                                <Typography variant="h6" gutterBottom>Model name</Typography>
                                {   groups.deployed && groups.deployed.length > 0 &&
                                    <Typography variant="body2" gutterBottom>{groups.deployed[0].model_d.name}</Typography>
                                }
                                <br/>
                                <Typography variant="h6" gutterBottom>Prediction variable</Typography>
                                {   groups.deployed && groups.deployed.length > 0 &&
                                    <Typography variant="body2" gutterBottom>{groups.deployed[0].model_d.training.y_yariable_d.column_name}</Typography>
                                }
                                <br/>
                                <Typography variant="h6" gutterBottom>Time variable</Typography>
                                {   groups.deployed && groups.deployed.length > 0 &&
                                <Typography variant="body2" gutterBottom>{groups.deployed[0].model_d.training.time_yariable_d.column_name}</Typography>
                                }
                                <br/>
                                <Button  onClick={(e)=> {this.props.history.push('/training/'+this.state.project_id)}} variant="contained" color="primary" className={classes.button}>
                                    View model data
                                </Button>
                                <br/>
                                <Button onClick={(e)=> {this.props.history.push('/dashboard/'+this.state.project_id)}} variant="contained" color="primary" className={classes.button}>
                                    View data schema
                                </Button>
                            </Paper>
                        </Grid>
                        <Grid item xs={9}>
                            <Paper className={[classes.paper, classes.datasetContainer]}>
                                <Grid container>
                                    <Grid xs={8}>
                                        <Typography variant="h6" gutterBottom>Datasets</Typography>
                                    </Grid>
                                    <Grid xs={4} style={{textAlign: 'right'}}>
                                        {  groups.testable==true && (this.state.progress.step==-1 || this.state.progress.step>=4) &&
                                            <Button onClick={this.proceedTesting} size="small" color="primary">
                                                Do testing
                                            </Button>
                                        }
                                    </Grid>
                                </Grid>
                                <br/>
                                <Grid container justify="center">
                                    {
                                        groups.metas && groups.metas.length > 0 && groups.metas.map((row, index) => (

                                            groups.deployed && groups.deployed.length &&  ((groups.deployed[0].model_d.training.processed_file_d.parent == null && row.dataset.id == groups.deployed[0].model_d.training.processed_file) ||
                                            (groups.deployed[0].model_d.training.processed_file_d.parent && groups.deployed[0].model_d.training.processed_file_d.parent.datasetindexOf(row.dataset.id) != -1)) &&
                                            <Grid item xs={4} alignItems='center' className={classes.tablecontainer} key={index}>
                                                <table className={classes.table}>
                                                    <tr>
                                                        <th>{row.dataset.name.split('.')[0]}</th>
                                                    </tr>
                                                    {
                                                        row.meta.map((obj) => (
                                                            <tr key={obj.id}>
                                                                <td>{obj.column_name}</td>
                                                            </tr>
                                                        ))
                                                    }
                                                </table>
                                                <br/>
                                                { (this.state.progress.step==-1 || this.state.progress.step>=4) &&
                                                    <Button size="small" onClick={(e) => {
                                                        $('#fileinput').trigger('click');
                                                        this.setState({data_id: row.dataset.id})
                                                    }} color="primary" className={classes.button}>
                                                        Upload testing set
                                                    </Button>
                                                }
                                            </Grid>
                                        ))
                                    }

                                    <div className={classes.hiddenfile}>
                                        <input name="upload" type="file" id="fileinput" onInput={this.handleChange}/>
                                    </div>

                                </Grid>
                                <br/>
                            </Paper>
                            <br/>
                            <Paper className={classes.paper}>
                                <Typography variant="h6" gutterBottom>Prediction</Typography>
                                {   prediction_data ?
                                    <Line data={prediction_data}/>:
                                    <Typography variant="body2" gutterBottom>no graph generated</Typography>
                                }
                            </Paper>
                        </Grid>
                    </Grid>
                </Grid>
            </div>
        );
    }
}

function mapStateToProps(state) {
    const { groups, authentication } = state;
    return {
        authentication,
        groups
    };
}

const connectedGraphPage = withRouter(withStyles(styles)(connect(mapStateToProps)(GraphPage)));
export { connectedGraphPage as GraphPage };