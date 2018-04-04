import { autobind } from 'core-decorators';
import React from 'react';
import ReactDOM from 'react-dom';

import { fibonacci } from './fibonacci';

class Application extends React.PureComponent {

    state = {
        n: `1`,
    };

    @autobind handleChange(e) {

        this.setState({
            n: e.target.value,
        });

    }

    render() {

        return <div>

            Everything is working just fine! And as a bonus, here's a fibonacci number calculator:

            <div style={{ marginTop: 10 }}>
                <input value={this.state.n} onChange={this.handleChange} />
                <input value={fibonacci(parseInt(this.state.n, 10) || 1)} readOnly={true} />
            </div>

        </div>;

    }

}

ReactDOM.render(<Application />, document.body);
